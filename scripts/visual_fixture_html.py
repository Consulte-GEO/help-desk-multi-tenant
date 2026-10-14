"""Remove script elements from trusted repository HTML in private visual fixtures.

This is test tooling, never a sanitizer or a production HTML entry point.
"""
from html.parser import HTMLParser


def without_scripts(source):
    class ScriptSpans(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=False)
            self.lines = [0]
            for position, char in enumerate(source):
                if char == '\n':
                    self.lines.append(position + 1)
            self.start = None
            self.spans = []

        def source_offset(self):
            line, column = self.getpos()
            return self.lines[line - 1] + column

        def handle_starttag(self, tag, attrs):
            if tag == 'script' and self.start is None:
                self.start = self.source_offset()

        def handle_startendtag(self, tag, attrs):
            if tag == 'script':
                start = self.source_offset()
                self.spans.append((start, start + len(self.get_starttag_text())))

        def handle_endtag(self, tag):
            if tag == 'script' and self.start is not None:
                self.spans.append((self.start, source.index('>', self.source_offset()) + 1))
                self.start = None

    parser = ScriptSpans()
    parser.feed(source)
    parser.close()
    if parser.start is not None:
        parser.spans.append((parser.start, len(source)))
    cursor = 0
    pieces = []
    for start, end in parser.spans:
        pieces.append(source[cursor:start])
        cursor = end
    pieces.append(source[cursor:])
    return ''.join(pieces)
