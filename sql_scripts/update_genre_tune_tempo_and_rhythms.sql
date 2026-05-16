UPDATE public.genre_tune_type
SET
    default_bpm = v.bpm
FROM
    (
        VALUES
            ('BGRA', 'Breakdown', 125),
            ('BGRA', 'JigD', 110),
            ('BGRA', 'Piece', 95),
            ('BGRA', 'Reel', 120),
            ('BGRA', 'Song', 85),
            ('BGRA', 'Waltz', 140),
            ('BLUES', 'BluesShuffle', 100),
            ('BLUES', 'DeltaBlues', 80),
            ('CAJUN', 'TwoStep', 105),
            ('CAJUN', 'WaltzCajun', 145),
            ('CONTRA', 'JigD', 115),
            ('CONTRA', 'Mzrka', 110),
            ('CONTRA', 'Polka', 115),
            ('CONTRA', 'Reel', 118),
            ('CONTRA', 'Schot', 80),
            ('CONTRA', 'Waltz', 120),
            ('FADO', 'FadoCancao', 60),
            ('FADO', 'FadoCorrido', 100),
            ('FADO', 'FadoMenor', 50),
            ('FLAM', 'Alegrias', 120),
            ('FLAM', 'Bulerias', 210),
            ('FLAM', 'Seguiriyas', 140),
            ('FLAM', 'Soleares', 100),
            ('FRCAN', 'Air', 60),
            ('FRCAN', 'Branle', 100),
            ('FRCAN', 'JigD', 115),
            ('FRCAN', 'Piece', 95),
            ('FRCAN', 'Quadrille', 110),
            ('FRCAN', 'Reel', 115),
            ('FRCAN', 'Song', 80),
            ('FRCAN', 'Waltz', 135),
            ('GAME', 'Pelog', 80),
            ('GAME', 'Slendro', 80),
            ('ITRAD', 'Air', 60),
            ('ITRAD', 'BDnce', 90),
            ('ITRAD', 'Hland', 80),
            ('ITRAD', 'Hpipe', 85),
            ('ITRAD', 'JigD', 115),
            ('ITRAD', 'JigSl', 115),
            ('ITRAD', 'Mzrka', 110),
            ('ITRAD', 'Piece', 90),
            ('ITRAD', 'Polka', 120),
            ('ITRAD', 'Reel', 110),
            ('ITRAD', 'Schot', 80),
            ('ITRAD', 'SetD', 110),
            ('ITRAD', 'SgJig', 115),
            ('ITRAD', 'SgReel', 110),
            ('ITRAD', 'Slide', 120),
            ('ITRAD', 'Song', 80),
            ('ITRAD', 'Strath', 110),
            ('ITRAD', 'three-two', 90),
            ('ITRAD', 'Waltz', 135),
            ('KLEZM', 'Bulgar', 130),
            ('KLEZM', 'Doina', 60),
            ('KLEZM', 'Freylekh', 140),
            ('KLEZM', 'Khosidl', 85),
            ('NFLD', 'Air', 60),
            ('NFLD', 'JigD', 115),
            ('NFLD', 'NFLDPolska', 100),
            ('NFLD', 'NFLDSlide', 120),
            ('NFLD', 'Piece', 90),
            ('NFLD', 'Reel', 110),
            ('NFLD', 'Song', 80),
            ('NFLD', 'Waltz', 135),
            ('OTIME', 'Air', 60),
            ('OTIME', 'Hpipe', 85),
            ('OTIME', 'JigD', 115),
            ('OTIME', 'Piece', 90),
            ('OTIME', 'Reel', 115),
            ('OTIME', 'SgJig', 115),
            ('OTIME', 'Song', 80),
            ('OTIME', 'Waltz', 130),
            ('SAMBA', 'SambaBatucada', 140),
            ('SAMBA', 'SambaEnredo', 140),
            ('SAMBA', 'SambaPagode', 100),
            ('SCOT', 'Air', 60),
            ('SCOT', 'Hpipe', 80),
            ('SCOT', 'JigD', 110),
            ('SCOT', 'March', 90),
            ('SCOT', 'Piece', 90),
            ('SCOT', 'Reel', 110),
            ('SCOT', 'SgJig', 110),
            ('SCOT', 'SlowAir', 50),
            ('SCOT', 'Song', 80),
            ('SCOT', 'Strath', 110),
            ('SCOT', 'Waltz', 130),
            ('TEXMX', 'Cumbia', 90),
            ('TEXMX', 'Ranchera', 120)
    ) AS v (genre, tune_type, bpm)
WHERE
    genre_tune_type.genre_id = v.genre
    AND genre_tune_type.tune_type_id = v.tune_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '11b49123-406d-4974-800a-4fb652ea0310', 'BGRA', 'Breakdown', 'Fast Bluegrass Drive', '*', 'M:2/2
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '7654ad79-6be3-4ca8-b350-8909fb304c40', 'BGRA', 'JigD', 'Bluegrass Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'ad46a259-0e0a-4904-8278-d99c85e7e8e5', 'BGRA', 'Piece', 'Bluegrass 4/4 Stride', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'ba54b816-c6e5-46f8-a454-e7e439983dd6', 'BGRA', 'Reel', 'Bluegrass Reel', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '4ade0305-d57f-4923-890b-fde18ee4e8ec', 'BGRA', 'Song', 'Folk Song Chug', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 C2 c4 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'ff0f60f1-0bb5-4621-8942-439a6c456c3b', 'BGRA', 'Waltz', 'Fast Bluegrass Waltz', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '7ceae0dc-77aa-42aa-8b8a-9f0d990360b5', 'BLUES', 'BluesShuffle', 'Heavy 12/8 Shuffle', '*', 'M:12/8
L:1/8
K:clef=perc
|: C2 c C c c C2 c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'ffa1e91c-2f4b-4210-bcd1-533ba3e9f44a', 'BLUES', 'DeltaBlues', 'Delta Stomp', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c2 C2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '683bd407-aeae-417c-a601-abda1f22f9e5', 'CAJUN', 'TwoStep', 'Cajun Two-Step', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'd4936e9f-9a6a-458e-ac3c-581a372e653e', 'CAJUN', 'WaltzCajun', 'Cajun Waltz Swing', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '37074000-1f3a-4940-bbd7-ba1751c555ea', 'CONTRA', 'JigD', 'Contra Double Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'f24134ff-94c7-4852-b9eb-bf2882ecb19c', 'CONTRA', 'Mzrka', 'Contra Mazurka', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 C2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'ae8cdb87-4ffd-453c-b18a-b0a6da45c8e8', 'CONTRA', 'Polka', 'Contra Polka Jump', '*', 'M:2/4
L:1/8
K:clef=perc
|: C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'd7347bc3-8501-4d6f-8500-e3da178e1df0', 'CONTRA', 'Reel', 'Contra Driving Reel', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '9a94b6fd-a3e4-4378-a918-75ae0010cfef', 'CONTRA', 'Schot', 'Contra Schottische', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '3aaeccff-58f5-4b3d-bbaf-b9de3cf4ed39', 'CONTRA', 'Waltz', 'Contra Waltz Glide', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '0c91eb1b-11ba-4619-b207-1415ccac573e', 'FADO', 'FadoCancao', 'Fado 4/4 Stride', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'ffb07d8f-36c3-49ee-8240-75dc07283a94', 'FADO', 'FadoCorrido', 'Fado 2/4 Pulse', '*', 'M:2/4
L:1/8
K:clef=perc
|: C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '909edf6d-54c1-4676-b19f-fd305537c2b6', 'FADO', 'FadoMenor', 'Sparse Slow Fado', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'e8dd2067-82d3-4e38-86d8-909cde9ac251', 'FLAM', 'Alegrias', 'Alegrias 12-Beat', '*', 'M:12/4
L:1/4
K:clef=perc
|: c c C c c c C c C c C c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'c5f1b589-900f-4bac-925e-d6d4c352ed21', 'FLAM', 'Bulerias', 'Bulerias Fast 12-Beat', '*', 'M:12/8
L:1/8
K:clef=perc
|: c2 C c2 c C2 c C2 C :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '9d652676-436f-49e9-8118-be69a6ae78c2', 'FLAM', 'Seguiriyas', 'Seguiriyas Pulse', '*', 'M:3/4
L:1/8
K:clef=perc
|: C c c C c C :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '55cded5f-154b-4944-9398-a9afa6875dd7', 'FLAM', 'Soleares', 'Soleares 12-Beat', '*', 'M:12/4
L:1/4
K:clef=perc
|: c c C c c c C c C c C c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '838654fe-0fd3-4cca-9626-fe245e287c8e', 'FRCAN', 'Air', 'Sparse Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '7d311815-d7a5-4750-90bb-5bfa95e20594', 'FRCAN', 'Branle', 'Branle Stride', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '34db5ae2-0974-4132-8daa-a3c7aa4d5377', 'FRCAN', 'JigD', 'Quebecois 6/8', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '32a698be-6d05-4a4d-81c9-7917a63173a9', 'FRCAN', 'Piece', 'Marching Pulse', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'a38a8b11-e0c9-4497-85c8-1e1430370c6a', 'FRCAN', 'Quadrille', 'Quadrille Bounce', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '4f540f9e-b606-4efe-8f94-ce94f53525b0', 'FRCAN', 'Reel', 'Crooked Reel Driver', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'c0af7840-670f-43ff-9c7f-86b1dcdf1a99', 'FRCAN', 'Song', 'Chanson Backing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'ba1711d1-1026-40e5-8183-bce099644b8f', 'FRCAN', 'Waltz', 'Valse Swing', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '5d100c22-ac7a-4994-8ab2-03f44154aaa7', 'GAME', 'Pelog', 'Gong Cycle', '*', 'M:4/4
L:1/8
K:clef=perc
|: c2 c2 c2 C2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'ab8d4e92-6033-472e-8837-27a743ae6253', 'GAME', 'Slendro', 'Gong Cycle', '*', 'M:4/4
L:1/8
K:clef=perc
|: c2 c2 c2 C2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '735694a5-faf2-43b9-a097-68c65e60875e', 'ITRAD', 'Air', 'Sparse Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'f478768a-5b8a-4ffe-a81a-f64aeda6d202', 'ITRAD', 'BDnce', 'Barn Dance Flow', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'd5664483-fdf2-423e-9af7-2f5000d9ea7f', 'ITRAD', 'Hland', 'Highland Swing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'fdb7d987-1168-41f4-a931-b49054a76141', 'ITRAD', 'Hpipe', 'Hornpipe Swung', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '9863ac89-c453-45ab-a0bb-e635cfaa74f7', 'ITRAD', 'JigD', 'Standard Double Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2c Ccc | C2c Ccc | C2c Ccc | ccc Ccc :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '9ba21c8f-7ac4-4082-8736-495a4f99e3c2', 'ITRAD', 'JigSl', 'Standard Slip Jig', '*', 'M:9/8
L:1/8
K:clef=perc
|: C2 c C c c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'a7c8b038-b52e-43b5-a536-24c578fe0213', 'ITRAD', 'Mzrka', 'Mazurka Pulse', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 C2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'ac2fe4d1-59c3-4a70-adb5-061816baf094', 'ITRAD', 'Piece', 'Basic 4/4 March', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '06bf99a5-4ea1-49ee-b2d7-e9158d71c49a', 'ITRAD', 'Polka', 'Upbeat Polka', '*', 'M:2/4
L:1/8
K:clef=perc
|: C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '38eb41aa-5e12-4c4b-9476-55c30ce0ad6b', 'ITRAD', 'Reel', 'Standard Driving Reel', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '0bf12182-5695-4f2c-8016-89ca41f9c967', 'ITRAD', 'Schot', 'Schottische Bounce', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'b4694b23-95cb-438f-9ecd-4fdd25eab259', 'ITRAD', 'SetD', 'Set Dance Driver', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '2f40c0b2-192f-4adb-b61e-68222af1789e', 'ITRAD', 'SgJig', 'Single Jig Stride', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C3 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '11622530-dcf1-4509-a662-c665a4992451', 'ITRAD', 'SgReel', 'Single Reel Pulse', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'b5cb611c-05a8-48ec-aa70-efaa3901c74a', 'ITRAD', 'Slide', 'Driving Slide', '*', 'M:12/8
L:1/8
K:clef=perc
|: C2 c C c c C2 c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '238e6850-3594-42ea-b5e1-7164858d47b2', 'ITRAD', 'Song', 'Sparse Vocal Backing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '8c8aa454-3675-470b-9ae1-e41af6f34881', 'ITRAD', 'Strath', 'Strathspey Snap', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c c<C C>c c<C :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'fa13a377-dfc7-421e-8712-c4825c5cc85f', 'ITRAD', 'three-two', '3/2 Hornpipe Pulse', '*', 'M:3/2
L:1/8
K:clef=perc
|: C4 c4 c4 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '670ce5ef-0eac-448c-994d-7ddb23773964', 'ITRAD', 'Waltz', 'Irish Waltz Flow', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '74c51ddd-baaa-4425-b282-bc69743d6564', 'KLEZM', 'Bulgar', 'Bulgar 8-Beat Syncopation', '*', 'M:8/8
L:1/8
K:clef=perc
|: C3 c3 C2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '7c5e9ebd-4f81-4d73-b404-12d9422d9384', 'KLEZM', 'Doina', 'Free Rhythm Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '11c6c292-2a0f-4c23-ab17-5e9b694a722e', 'KLEZM', 'Freylekh', 'Freylekh Dance Pulse', '*', 'M:2/4
L:1/8
K:clef=perc
|: C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '6329c46d-957f-4306-a039-9ceec8cba579', 'KLEZM', 'Khosidl', 'Slow Khosidl Stride', '*', 'M:2/4
L:1/8
K:clef=perc
|: C>c C>c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'b2237887-12c4-4819-b246-1d2593ea9c65', 'NFLD', 'Air', 'Sparse Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '3e1eb667-25c9-41cf-9737-47bc5c962942', 'NFLD', 'JigD', 'Double Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '790bcd3f-4588-44d1-aa43-70cf3c83dcf3', 'NFLD', 'NFLDPolska', 'Polska 3/4 Swing', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '9b4a04b0-0821-409d-8b40-d1e73dc7e1c5', 'NFLD', 'NFLDSlide', 'Driving Slide', '*', 'M:12/8
L:1/8
K:clef=perc
|: C2 c C c c C2 c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '5100e7a3-07ec-452b-8f7f-77ae59d9568d', 'NFLD', 'Piece', '4/4 Pulse', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '56d9c2d5-afb8-4f12-9e80-e01dde8a86a9', 'NFLD', 'Reel', 'Driving Reel', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'e23ad177-7ce2-482d-a1b1-ee72414221e7', 'NFLD', 'Song', 'Song Backing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '5bc02799-f44d-4f2a-9fb9-047e88ca7ad1', 'NFLD', 'Waltz', 'Waltz Flow', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '7960dbf5-e710-43e0-bd64-aee4615b1c9c', 'OTIME', 'Air', 'Sparse Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '5a459a26-a871-4934-ad70-c9b960987a24', 'OTIME', 'Hpipe', 'Old-Time Hornpipe', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '1513ef6d-e25e-4fbe-850e-b01405a0a05a', 'OTIME', 'JigD', 'Old-Time Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'aada6b0e-fb94-4732-9f84-8a767b093413', 'OTIME', 'Piece', 'Basic 4/4 Pulse', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '26cab7d8-6fc3-44e4-a951-11425b919f49', 'OTIME', 'Reel', 'Clawhammer Drive', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '8e03aca4-8f72-4d08-a676-5fee67acf181', 'OTIME', 'SgJig', 'Single Jig Stride', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C3 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '8f3b92b4-4823-4396-97e1-6232e31fa30c', 'OTIME', 'Song', 'Ballad Backing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '9010e1c7-f268-4f94-afb2-5237e36e99ff', 'OTIME', 'Waltz', 'Old-Time Waltz', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '80209826-3e34-4d28-b784-263be63aa36b', 'SAMBA', 'SambaBatucada', 'Batucada 2/4 Fast', '*', 'M:2/4
L:1/16
K:clef=perc
|: C2cc C2cc :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '93da1c05-8865-478c-846c-86a745c4e977', 'SAMBA', 'SambaEnredo', 'Enredo Pulse', '*', 'M:2/4
L:1/16
K:clef=perc
|: CccC cCcC :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '46439759-4de2-42b9-8a59-74b9e5baa584', 'SAMBA', 'SambaPagode', 'Pagode Groove', '*', 'M:2/4
L:1/16
K:clef=perc
|: C2c2 C2cc :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'd6ae0a11-39d3-423d-86a3-4057c9c7dce2', 'SCOT', 'Air', 'Sparse Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '5b867dc3-44ee-4033-b59b-b04f3b86b915', 'SCOT', 'Hpipe', 'Scottish Hornpipe', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'dfa5b2ca-393d-4e85-b104-6c8efbf6e87d', 'SCOT', 'JigD', 'Double Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '4fb9bcee-4a3d-4b5c-9a81-0b95b7ae84c3', 'SCOT', 'March', '2/4 March Driver', '*', 'M:2/4
L:1/8
K:clef=perc
|: C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '4bc59e0c-25bd-4a98-8608-f9e17c5ffccf', 'SCOT', 'Piece', '4/4 Stride', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'f2303b72-def4-4ad2-8a78-b6a05ebf9aed', 'SCOT', 'Reel', 'Scottish Reel Driver', '*', 'M:4/2
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'aa649e59-77ac-4e50-aa2b-74e7b5546215', 'SCOT', 'SgJig', 'Single Jig Stride', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C3 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'ad42a7b4-8336-4ab1-928f-922b81e53c9e', 'SCOT', 'SlowAir', 'Very Slow Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '6e2b4cf8-6b51-4805-8bc4-374003d5ef12', 'SCOT', 'Song', 'Song Backing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '3c74da78-f052-46fa-80b4-d0a969fab91a', 'SCOT', 'Strath', 'Strathspey Snap', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c c<C C>c c<C :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    'b927881a-a448-4d54-bad6-5e1b1d2c1597', 'SCOT', 'Waltz', 'Waltz Glide', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '16d5b035-ead1-407c-b559-1cb5216ce337', 'TEXMX', 'Cumbia', 'Cumbia Upbeat', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

INSERT INTO public.rhythm_patterns (
    id, genre_id, tune_type_id, name, part_target, abc_string, is_default, premium_audio_url, sample_kit, pattern_type
)
VALUES (
    '5e2016ce-7e14-4279-8564-5087dab090bf', 'TEXMX', 'Ranchera', 'Ranchera 3/4 Waltz', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    part_target = EXCLUDED.part_target,
    abc_string = EXCLUDED.abc_string,
    is_default = EXCLUDED.is_default,
    premium_audio_url = EXCLUDED.premium_audio_url,
    sample_kit = EXCLUDED.sample_kit,
    pattern_type = EXCLUDED.pattern_type;

-- Summary
\echo
\echo '=== genre/rhythm apply summary ==='
SELECT 'genre_tune_type rows updated' AS item, COUNT(*)::text AS value FROM public.genre_tune_type WHERE default_bpm IS NOT NULL
UNION ALL
SELECT 'seed rhythm_patterns', COUNT(*)::text FROM public.rhythm_patterns WHERE pattern_type = 'seed'
UNION ALL
SELECT 'distinct genres seeded', COUNT(DISTINCT genre_id)::text FROM public.rhythm_patterns WHERE pattern_type = 'seed'
UNION ALL
SELECT 'distinct tune types seeded', COUNT(DISTINCT tune_type_id)::text FROM public.rhythm_patterns WHERE pattern_type = 'seed';
