grammar UIGrammar;

// Terminals
BUTTON: 'button';
LABEL: 'label';
TEXT_FIELD: 'text_field';

// Productions
ui_element: BUTTON | LABEL | TEXT_FIELD;
container: ui_element | container ui_element;
form: container (LABEL TEXT_FIELD)*;