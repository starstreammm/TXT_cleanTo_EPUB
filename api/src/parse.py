import copy
import json
from typing import get_args
import aiofiles
import re
from models import Pattern, DATA_PATH, PatternType

PATTERN_PATH = DATA_PATH / "pattern.json"
PATTERN_PATH.parent.mkdir(parents=True, exist_ok=True)

DEFAULT_PATTERN: dict[PatternType, list[Pattern]] = {
    "file": [
        Pattern(enable=True, alias="基本", pattern="{title}"),
        Pattern(enable=True, alias="标题_作者", pattern="{title}_{creator}"),
        Pattern(enable=True, alias="标题-作者", pattern="{title}-{creator}"),
        Pattern(enable=True, alias="小说下载器", pattern="[{creator}]{title}"),
    ],
    "chapter": [
        Pattern(enable=True, alias="第几章 标题", pattern="第{chapter}章 {title}"),
        Pattern(enable=True, alias="第几章_标题", pattern="第{chapter}章_{title}"),
        Pattern(enable=True, alias="番外 标题", pattern="番外{chapter} {title}"),
        Pattern(enable=True, alias="番外_标题", pattern="番外{chapter}_{title}"),
        Pattern(enable=True, alias="序号 标题", pattern="{chapter} {title}"),
        Pattern(enable=True, alias="序号、标题", pattern="{chapter}、{title}"),
    ],
    "adv": [
        Pattern(enable=True, alias="基本", pattern="广告{s}"),
    ],
    "volume": [
        Pattern(enable=True, alias="第几卷 标题", pattern="第{chapter}卷 {title}"),
        Pattern(enable=True, alias="第几卷_标题", pattern="第{chapter}卷_{title}"),
        Pattern(enable=True, alias="卷外 标题", pattern="卷外{chapter} {title}"),
        Pattern(enable=True, alias="卷外_标题", pattern="卷外{chapter}_{title}"),
    ],
}
TOKEN_MAP = {
    r"\{title\}": r"(?P<title>\S.*)",
    r"\{creator\}": r"(?P<creator>[A-Za-z0-9\u4e00-\u9fff]+)",
    r"\{chapter\}": r"(?P<chapter>[零一二三四五六七八九十百千万]+|\d+)",
    r"\{extchapter\}": r"(?P<extchapter>[零一二三四五六七八九十百千万]+|\d+)",
    r"\{n\}": r"(\d+)",
    r"\{e\}": r"([A-Za-z]+)",
    r"\{s\}": r".*",
}


class ParseBase:
    _pattern: dict[PatternType, list[Pattern]] = DEFAULT_PATTERN
    _compiled_pattern: dict[PatternType, list[re.Pattern]] = {
        key: [] for key in get_args(PatternType)
    }

    @classmethod
    async def init(cls) -> None:
        if PATTERN_PATH.is_file():
            async with aiofiles.open(PATTERN_PATH, "r") as f:
                content = await f.read()
                cls._pattern = {
                    key: [Pattern.model_validate(p) for p in patterns]
                    for key, patterns in json.loads(content).items()
                }

        for key in get_args(PatternType):
            await cls._compile(key)

    @classmethod
    async def close(cls) -> None:
        async with aiofiles.open(PATTERN_PATH, "w") as f:
            await f.write(
                json.dumps(
                    {
                        key: [p.model_dump() for p in patterns]
                        for key, patterns in cls._pattern.items()
                    },
                    indent=4,
                    ensure_ascii=False,
                )
            )

    @classmethod
    def get(cls, type: PatternType) -> list[Pattern]:
        return cls._pattern[type]

    @classmethod
    async def update(cls, type: PatternType, patterns: list[Pattern]) -> None:
        cls._pattern[type] = patterns
        await cls._compile(type)

    @classmethod
    async def reset_default(cls, type: PatternType) -> None:
        cls._pattern[type] = copy.deepcopy(DEFAULT_PATTERN[type])
        await cls._compile(type)

    @classmethod
    def clear_adv(cls, string: str) -> str:
        for p in cls._compiled_pattern["adv"]:
            string = p.sub("", string)
        return string

    @classmethod
    def match(
        cls,
        type: PatternType,
        string: str,
    ) -> dict[str, str]:
        if type == "adv":
            raise ValueError("Type 'adv' is not supported for match method.")

        for p in cls._compiled_pattern[type]:

            match = p.match(string)
            if not match:
                continue

            result = match.groupdict()

            if result:
                if result.get("chapter"):
                    try:
                        result["chapter"] = int(result["chapter"])
                    except ValueError:
                        result["chapter"] = cls._chinese_to_int(result["chapter"])
                if result.get("extchapter"):
                    try:
                        result["extchapter"] = int(result["extchapter"])
                    except ValueError:
                        result["extchapter"] = cls._chinese_to_int(result["extchapter"])

                return result

        return {}

    @classmethod
    def match_line(
        cls,
        line: str,
        last_line_empty: bool,
    ) -> tuple[str, bool]:
        line = cls.clear_adv(line)

        if not line.strip():
            if last_line_empty:
                return "", True
            else:
                return "\n", True

        if re.match(r"^\s*[-=－＝—–─]{3,}\s*$", line):
            return '<div class="separator"></div>\n', True

        if pt := cls.match("volume", line):
            sline = "## " if last_line_empty else "\n## "

            if pt.get("chapter"):
                sline += f"第{cls._int_to_chinese(int(pt['chapter']))}卷"

            if pt.get("chapter") and pt.get("title"):
                sline += " "

            if pt.get("title"):
                sline += f"{pt['title']}"

            sline += "\n\n"
            return sline, True

        elif pt := cls.match("chapter", line):
            sline = "# " if last_line_empty else "\n# "

            if pt.get("chapter"):
                sline += f"第{pt[('chapter')]}章"

            elif pt.get("extchapter"):
                sline += f"番外{pt['extchapter']}"

            if (pt.get("chapter") or pt.get("extchapter")) and pt.get("title"):
                sline += " "

            if pt.get("title"):
                sline += f"{pt['title']}"

            sline += "\n\n"
            return sline, True

        elif line.startswith(" ") or line.startswith("\t") or line.startswith("　"):
            if last_line_empty:
                return f"{line.strip()}\n", False
            else:
                return f"\n{line.strip()}\n", False

        return f"{line.strip()}\n", False

    @classmethod
    async def _compile(cls, type: PatternType) -> None:
        p_pattern = [p.pattern for p in cls._pattern[type] if p.enable]
        p_sort = sorted(
            p_pattern,
            key=lambda p: len(
                p.replace(r"{n}", "a")
                .replace(r"{e}", "")
                .replace(r"{s}", "")
                .replace(r"{title}", "a")
                .replace(r"{creator}", "a")
                .replace(r"{chapter}", "aa")
                .replace(r"{extchapter}", "aa")
            ),
            reverse=True,
        )
        cls._compiled_pattern[type].clear()
        for p in p_sort:

            p = re.escape(p)

            for token, reg in TOKEN_MAP.items():
                p = p.replace(token, reg)

            p = p.replace(r"\(", r"[(（]")
            p = p.replace(r"\)", r"[)）]")
            p = p.replace(r"\[", r"[\[【]")
            p = p.replace(r"\]", r"[\]】]")

            if type == "adv":
                cls._compiled_pattern[type].append(re.compile(p))
            else:
                cls._compiled_pattern[type].append(re.compile("^" + p + "$"))

    @staticmethod
    def _chinese_to_int(s: str) -> int:
        NUM_MAP = {
            "零": 0,
            "一": 1,
            "二": 2,
            "三": 3,
            "四": 4,
            "五": 5,
            "六": 6,
            "七": 7,
            "八": 8,
            "九": 9,
        }
        UNIT_MAP = {
            "十": 10,
            "百": 100,
            "千": 1000,
            "万": 10000,
        }

        result = 0
        num = 0
        unit = 1

        for char in reversed(s):
            if char in NUM_MAP:
                num = NUM_MAP[char]
                result += num * unit

            elif char in UNIT_MAP:
                unit = UNIT_MAP[char]

            else:
                raise ValueError(f"非法中文数字: {char}")

        if "十" in s and result < 10:
            result += 10

        return result

    @staticmethod
    def _int_to_chinese(num: int) -> str:
        if num < 0 or num > 1e8:
            raise ValueError("Input error. Only supports integers from 0 to 1e8.")

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

            for divisor, unit in UNIT_MAP.items():
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
                result.append(NUM_MAP[num])

            return "".join(result)

        if num < 10000:
            return convert_under_1e4(num)
        else:
            high, low = divmod(num, 10000)
            front = convert_under_1e4(high)
            back = convert_under_1e4(low)
            return front + "万" + (back if low else "")
