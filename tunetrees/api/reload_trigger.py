# This file is an uber hacky way to enable the FastAPI server to reload,
# when it was started with --reload.
# CoPilot does not approve.  But I think it's massively simpler
# for testing purposes than trying to make the signal handling work,
# and keep vscode running in my vscode window.
# Hopefully this will be replaced with a more robust solution down the road.
# To be clean, it's only for triggering the reload for playwright testing, in order to
# reload a clean database for testing purposes.
def reload_trigger_func():
    print("reload_trigger_func() invoked, starting server...")
