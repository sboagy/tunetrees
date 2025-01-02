import sys
import os
import pytest
from antlr4 import CommonTokenStream, InputStream

# Add the design/ui_grammar directory to the system path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from UIGrammarLexer import UIGrammarLexer
from UIGrammarParser import UIGrammarParser
from antlr4.error.ErrorListener import ErrorListener


class TestErrorListener(ErrorListener):
    def __init__(self):
        super(TestErrorListener, self).__init__()
        self.errors = []

    def syntaxError(
        self,
        recognizer: UIGrammarParser,
        offendingSymbol: object,
        line: int,
        column: int,
        msg: str,
        e: Exception,
    ) -> None:
        self.errors.append((line, column, msg))


def test_input(input_text: str):
    input_stream = InputStream(input_text)
    lexer = UIGrammarLexer(input_stream)
    stream = CommonTokenStream(lexer)
    parser = UIGrammarParser(stream)
    parser.removeErrorListeners()
    error_listener = TestErrorListener()
    parser.addErrorListener(error_listener)

    tree = parser.form()  # Start rule for parsing
    assert tree is not None

    if error_listener.errors:
        print(f"Errors found: {error_listener.errors}")
    else:
        print(f"Parsing successful: {input_text}")


@pytest.mark.parametrize(
    "test_case",
    [
        "button",
        "label",
        "text_field",
        "button label text_field",
        "label text_field label text_field",
    ],
)
def test_ui_grammar_cases(test_case: str):
    test_input(test_case)


def test_discovery():
    pass


if __name__ == "__main__":
    pytest.main()
