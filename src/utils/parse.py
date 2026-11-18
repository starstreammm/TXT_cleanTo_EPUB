import asyncio
import re

from models import HeadingConfiguration, Pattern, TEXT_TYPE
from utils import database

DEFAULT_FILENAME_PATTERNS = [
    Pattern(alias="基本", pattern="{title}"),
    Pattern(alias="标题_作者", pattern="{title}_{creator}"),
    Pattern(alias="标题-作者", pattern="{title}-{creator}"),
    Pattern(alias="小说下载器", pattern="[{creator}]{title}"),
]
TOKEN_MAP = {
    r"\{title\}": r"(?P<title>\S.*)",
    r"\{creator\}": r"(?P<creator>[A-Za-z0-9\u4e00-\u9fff]+)",
    r"\{index\}": r"(?P<index>[零〇一二两三四五六七八九十百千万亿]+|\d+)",
    r"\{n\}": r"(\d+)",
    r"\{e\}": r"([A-Za-z]+)",
    r"\{s\}": r"\s",
    r"\{S\}": r"\S",
}
DIVIDER_PATTERN = re.compile(r"([-_*])(?:\s*\1){2,}|[-=－＝—–─]{3,}")


class ParseBase:
    _filename_patterns = DEFAULT_FILENAME_PATTERNS
    _compiled_filename: list[tuple[re.Pattern, Pattern]] = []
    _update_lock = asyncio.Lock()

    @classmethod
    async def init(cls) -> None:
        await asyncio.to_thread(database.initialize, DEFAULT_FILENAME_PATTERNS)
        cls._filename_patterns = await asyncio.to_thread(database.get_filename_patterns)
        cls._compiled_filename = cls.compile_rules("file", cls._filename_patterns)

    @classmethod
    def get_filename_patterns(cls) -> list[Pattern]:
        return cls._filename_patterns

    @classmethod
    async def update_filename_patterns(cls, patterns: list[Pattern]) -> None:
        compiled = cls.compile_rules("file", patterns)
        async with cls._update_lock:
            await asyncio.to_thread(database.save_filename_patterns, patterns)
            cls._filename_patterns = patterns
            cls._compiled_filename = compiled

    @classmethod
    async def reset_filename_patterns(cls) -> None:
        await cls.update_filename_patterns(DEFAULT_FILENAME_PATTERNS)

    @classmethod
    def compile_rules(cls, category: str, patterns: list[Pattern]):
        compiled = []
        ordered = sorted(
            patterns,
            key=lambda rule: len(re.sub(r"\{[^{}]+\}", "x", rule.pattern)),
            reverse=True,
        )
        for rule in ordered:
            if not rule.enable:
                continue
            tokens = set(re.findall(r"\{([^{}]+)\}", rule.pattern))
            if not rule.pattern.strip():
                raise ValueError("Enter a match pattern.")
            if category != "file":
                fmt = rule.replacement
                if not fmt or not fmt.strip():
                    raise ValueError("Enter a replacement format.")
                if re.search(r"^\s*#|[\r\n]", fmt):
                    raise ValueError(
                        "Use a single line without Markdown heading markers."
                    )
                allowed = {"reorder", "reorder-zh"} | (tokens & {"title", "index"})
                if "index" in tokens:
                    allowed.add("index-zh")
                for key in re.findall(r"\{([^{}]+)\}", fmt):
                    if key not in allowed:
                        raise ValueError(
                            f"Replacement placeholder {{{key}}} is unavailable for this match."
                        )
            expression = re.escape(rule.pattern)
            for key, regex in TOKEN_MAP.items():
                if category != "file" and key == r"\{creator\}":
                    continue
                expression = expression.replace(key, regex)
            for key, chars in (
                (r"\(", "[(（]"),
                (r"\)", "[)）]"),
                (r"\[", r"[\[【]"),
                (r"\]", r"[\]】]"),
            ):
                expression = expression.replace(key, chars)
            regex = re.compile("^" + expression + "$")
            compiled.append((regex, rule))
        return compiled

    @classmethod
    def match_filename(cls, filename: str, used: list[str] | None = None):
        for regex, rule in cls._compiled_filename:
            if match := regex.fullmatch(filename):
                if used is not None:
                    used.append(rule.pattern)
                return match.groupdict()
        return {}

    def __init__(self, settings: HeadingConfiguration):
        self.rules = {}
        self.counts = {}
        self.restart = {}
        self.used = {}
        for category in ("volume", "chapter", "section"):
            config = settings.get(category)
            self.rules[category] = (
                self.compile_rules(category, config.patterns) if config else []
            )
            self.restart[category] = config.restart if config else True
            self.counts[category] = 0

    def match_line(
        self, line: str, prev_blank: bool, type: TEXT_TYPE
    ) -> tuple[str, bool]:
        line = line.strip()
        spacing = "" if prev_blank else "\n"
        if not line:
            return spacing, True
        if DIVIDER_PATTERN.fullmatch(line):
            return spacing + "***\n\n", True
        for level, (category, rules) in enumerate(self.rules.items(), 1):
            for regex, rule in rules:
                match = regex.fullmatch(line)
                if not match:
                    continue
                self.counts[category] += 1
                if category == "volume" and self.restart["chapter"]:
                    self.counts["chapter"] = 0
                if category == "chapter" and self.restart["section"]:
                    self.counts["section"] = 0
                fields = match.groupdict()
                if raw := fields.get("index"):
                    number = int(raw) if raw.isdecimal() else self._chinese_to_int(raw)
                    fields["index"] = str(number)
                    if "{index-zh}" in rule.replacement:
                        fields["index-zh"] = self._int_to_chinese(number)
                fields["reorder"] = str(self.counts[category])
                if "{reorder-zh}" in rule.replacement:
                    fields["reorder-zh"] = self._int_to_chinese(self.counts[category])
                heading = re.sub(
                    r"\{([^{}]+)\}", lambda m: fields[m[1]], rule.replacement
                )
                history_key = (category, rule.pattern, rule.replacement)
                self.used.pop(history_key, None)
                self.used[history_key] = None
                return spacing + "#" * level + " " + heading.strip() + "\n\n", True
        return spacing + line + "\n", False

    @staticmethod
    def _chinese_to_int(s: str) -> int:
        digits = "零一二三四五六七八九"
        s = s.replace("〇", "零").replace("两", "二")
        if all(char in digits for char in s):
            return int("".join(str(digits.index(char)) for char in s))
        for unit, size in (("亿", 100000000), ("万", 10000)):
            if unit in s:
                high, low = s.split(unit, 1)
                return ParseBase._chinese_to_int(high or "一") * size + (
                    ParseBase._chinese_to_int(low) if low else 0
                )
        total = digit = 0
        for char in s:
            if char in digits:
                digit = digits.index(char)
            else:
                total += (digit or 1) * {"十": 10, "百": 100, "千": 1000}[char]
                digit = 0
        return total + digit

    @staticmethod
    def _int_to_chinese(num: int) -> str:
        NUM_MAP = {
            0: "零",
            1: "一",
            2: "二",
            3: "三",
            4: "四",
            5: "五",
            6: "六",
            7: "七",
            8: "八",
            9: "九",
        }
        UNIT_MAP = {10: "十", 100: "百", 1000: "千", 10000: "万"}

        def convert_under_1e4(num: int) -> str:
            if num < 0 or num >= 10000:
                raise ValueError("Input error. Only supports integers from 0 to 9999.")

            if num < 10:
                return NUM_MAP[num]

            result = []
            zero_pending = False

            for divisor in (1000, 100, 10):
                unit = UNIT_MAP[divisor]
                digit, num = divmod(num, divisor)

                if digit:
                    if zero_pending:
                        result.append("零")
                        zero_pending = False

                    # 一十 -> 十
                    if not (divisor == 10 and digit == 1 and not result):
                        result.append(NUM_MAP[digit])

                    result.append(unit)

                elif result and num:
                    # 当前位为 0，但后面还有数字
                    zero_pending = True

            if num:
                if zero_pending:
                    result.append("零")
                result.append(NUM_MAP[num])

            return "".join(result)

        if num < 10000:
            return convert_under_1e4(num)
        else:
            high, low = divmod(num, 10000)
            unit = "万"
            if num >= 100000000:
                high, low = divmod(num, 100000000)
                unit = "亿"
            front = ParseBase._int_to_chinese(high)
            if not low:
                return front + unit
            back = ParseBase._int_to_chinese(low)
            if back.startswith("十"):
                back = "一" + back
            threshold = 1000 if unit == "万" else 10000000
            return front + unit + ("零" if low < threshold else "") + back
