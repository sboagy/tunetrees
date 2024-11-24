#!/bin/bash

sqlacodegen_v2 --generator sqlmodels sqlite:///tunetrees.sqlite3 > tunetrees/models/tunetrees_models_v2.py

python ./tunetrees/models/sqlgen_sqlmodel_tweaker.py ./tunetrees/models/tunetrees_models_v2.py