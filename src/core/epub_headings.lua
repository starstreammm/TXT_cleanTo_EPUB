function Pandoc(doc)
    local has_heading = false
    local only_h2 = true

    pandoc.Div(doc.blocks):walk({
        Header = function(header)
            has_heading = true
            if header.level ~= 2 then
                only_h2 = false
            end
        end,
    })

    if not has_heading or not only_h2 then
        return doc
    end

    -- Section divs bypass the EPUB writer's synthetic H1 without changing H2s.
    local sections = pandoc.utils.make_sections(false, nil, doc.blocks)
    local first = sections[1]
    if first.tag ~= "Div" or not first.content[1]
        or first.content[1].tag ~= "Header" then
        -- Keep introductory text in order, without a visible or listed title.
        doc.blocks:insert(1, pandoc.Header(2, {}, pandoc.Attr("", {
            "unnumbered", "unlisted", "epub-preamble-heading",
        })))
        sections = pandoc.utils.make_sections(false, nil, doc.blocks)
    end

    doc.blocks = sections
    return doc
end
