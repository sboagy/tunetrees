UPDATE public.genre_tune_type
SET
    default_bpm = v.bpm
FROM
    (
        VALUES
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
            ('CONTRA', 'JigD', 115),
            ('CONTRA', 'Mzrka', 110),
            ('CONTRA', 'Polka', 115),
            ('CONTRA', 'Reel', 118),
            ('CONTRA', 'Schot', 80),
            ('CONTRA', 'Waltz', 120)
    ) AS v (genre, tune_type, bpm)
WHERE
    genre_tune_type.genre_id = v.genre
    AND genre_tune_type.tune_type_id = v.tune_type;

INSERT INTO
    public.rhythm_patterns (
        genre_id,
        tune_type_id,
        name,
        abc_string,
        is_default
    )
VALUES
    -- ITRAD (Irish Traditional)
    (
        'ITRAD',
        'Air',
        'Sparse Drone',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'ITRAD',
        'BDnce',
        'Barn Dance Flow',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'ITRAD',
        'Hland',
        'Highland Swing',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C>c C>c C>c C>c :|',
        true
    ),
    (
        'ITRAD',
        'Hpipe',
        'Hornpipe Swung',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C>c C>c C>c C>c :|',
        true
    ),
    (
        'ITRAD',
        'JigD',
        'Standard Double Jig',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C c c :|',
        true
    ),
    (
        'ITRAD',
        'JigSl',
        'Standard Slip Jig',
        E'M:9/8\nL:1/8\nK:clef=perc\n|: C2 c C c c C c c :|',
        true
    ),
    (
        'ITRAD',
        'Mzrka',
        'Mazurka Pulse',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 :|',
        true
    ),
    (
        'ITRAD',
        'Piece',
        'Basic 4/4 March',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C4 c4 :|',
        true
    ),
    (
        'ITRAD',
        'Polka',
        'Upbeat Polka',
        E'M:2/4\nL:1/8\nK:clef=perc\n|: C2 c2 :|',
        true
    ),
    (
        'ITRAD',
        'Reel',
        'Standard Driving Reel',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'ITRAD',
        'Schot',
        'Schottische Bounce',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C>c C>c C>c C>c :|',
        true
    ),
    (
        'ITRAD',
        'SetD',
        'Set Dance Driver',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'ITRAD',
        'SgJig',
        'Single Jig Stride',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C3 :|',
        true
    ),
    (
        'ITRAD',
        'SgReel',
        'Single Reel Pulse',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'ITRAD',
        'Slide',
        'Driving Slide',
        E'M:12/8\nL:1/8\nK:clef=perc\n|: C2 c C c c C2 c C c c :|',
        true
    ),
    (
        'ITRAD',
        'Song',
        'Sparse Vocal Backing',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'ITRAD',
        'Strath',
        'Strathspey Snap',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C>c c<C C>c c<C :|',
        true
    ),
    (
        'ITRAD',
        'three-two',
        '3/2 Hornpipe Pulse',
        E'M:3/2\nL:1/8\nK:clef=perc\n|: C4 c4 c4 :|',
        true
    ),
    (
        'ITRAD',
        'Waltz',
        'Irish Waltz Flow',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 c2 :|',
        true
    ),
    -- CONTRA (Contra Dance Music)
    (
        'CONTRA',
        'JigD',
        'Contra Double Jig',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C c c :|',
        true
    ),
    (
        'CONTRA',
        'Mzrka',
        'Contra Mazurka',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 :|',
        true
    ),
    (
        'CONTRA',
        'Polka',
        'Contra Polka Jump',
        E'M:2/4\nL:1/8\nK:clef=perc\n|: C2 c2 :|',
        true
    ),
    (
        'CONTRA',
        'Reel',
        'Contra Driving Reel',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'CONTRA',
        'Schot',
        'Contra Schottische',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C>c C>c C>c C>c :|',
        true
    ),
    (
        'CONTRA',
        'Waltz',
        'Contra Waltz Glide',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 c2 :|',
        true
    );

UPDATE public.genre_tune_type
SET
    default_bpm = v.bpm
FROM
    (
        VALUES
            -- BGRA (Bluegrass)
            ('BGRA', 'Breakdown', 125),
            ('BGRA', 'JigD', 110),
            ('BGRA', 'Piece', 95),
            ('BGRA', 'Reel', 120),
            ('BGRA', 'Song', 85),
            ('BGRA', 'Waltz', 140),
            -- BLUES
            ('BLUES', 'BluesShuffle', 100),
            ('BLUES', 'DeltaBlues', 80),
            -- CAJUN
            ('CAJUN', 'TwoStep', 105),
            ('CAJUN', 'WaltzCajun', 145),
            -- FRCAN (French-Canadian)
            ('FRCAN', 'Air', 60),
            ('FRCAN', 'Branle', 100),
            ('FRCAN', 'JigD', 115),
            ('FRCAN', 'Piece', 95),
            ('FRCAN', 'Quadrille', 110),
            ('FRCAN', 'Reel', 115),
            ('FRCAN', 'Song', 80),
            ('FRCAN', 'Waltz', 135),
            -- OTIME (Old-Time)
            ('OTIME', 'Air', 60),
            ('OTIME', 'Hpipe', 85),
            ('OTIME', 'JigD', 115),
            ('OTIME', 'Piece', 90),
            ('OTIME', 'Reel', 115),
            ('OTIME', 'SgJig', 115),
            ('OTIME', 'Song', 80),
            ('OTIME', 'Waltz', 130)
    ) AS v (genre, tune_type, bpm)
WHERE
    genre_tune_type.genre_id = v.genre
    AND genre_tune_type.tune_type_id = v.tune_type;

INSERT INTO
    public.rhythm_patterns (
        genre_id,
        tune_type_id,
        name,
        abc_string,
        is_default
    )
VALUES
    -- BGRA (Bluegrass)
    (
        'BGRA',
        'Breakdown',
        'Fast Bluegrass Drive',
        E'M:2/2\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'BGRA',
        'JigD',
        'Bluegrass Jig',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C c c :|',
        true
    ),
    (
        'BGRA',
        'Piece',
        'Bluegrass 4/4 Stride',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C4 c4 :|',
        true
    ),
    (
        'BGRA',
        'Reel',
        'Bluegrass Reel',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'BGRA',
        'Song',
        'Folk Song Chug',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 C2 c4 :|',
        true
    ),
    (
        'BGRA',
        'Waltz',
        'Fast Bluegrass Waltz',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 c2 :|',
        true
    ),
    -- BLUES
    (
        'BLUES',
        'BluesShuffle',
        'Heavy 12/8 Shuffle',
        E'M:12/8\nL:1/8\nK:clef=perc\n|: C2 c C c c C2 c C c c :|',
        true
    ),
    (
        'BLUES',
        'DeltaBlues',
        'Delta Stomp',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C4 c2 C2 :|',
        true
    ),
    -- CAJUN
    (
        'CAJUN',
        'TwoStep',
        'Cajun Two-Step',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'CAJUN',
        'WaltzCajun',
        'Cajun Waltz Swing',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 c2 :|',
        true
    ),
    -- FRCAN (French-Canadian)
    (
        'FRCAN',
        'Air',
        'Sparse Drone',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'FRCAN',
        'Branle',
        'Branle Stride',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'FRCAN',
        'JigD',
        'Quebecois 6/8',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C c c :|',
        true
    ),
    (
        'FRCAN',
        'Piece',
        'Marching Pulse',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C4 c4 :|',
        true
    ),
    (
        'FRCAN',
        'Quadrille',
        'Quadrille Bounce',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C c c :|',
        true
    ),
    (
        'FRCAN',
        'Reel',
        'Crooked Reel Driver',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'FRCAN',
        'Song',
        'Chanson Backing',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'FRCAN',
        'Waltz',
        'Valse Swing',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 c2 :|',
        true
    ),
    -- OTIME (Old-Time)
    (
        'OTIME',
        'Air',
        'Sparse Drone',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'OTIME',
        'Hpipe',
        'Old-Time Hornpipe',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C>c C>c C>c C>c :|',
        true
    ),
    (
        'OTIME',
        'JigD',
        'Old-Time Jig',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C c c :|',
        true
    ),
    (
        'OTIME',
        'Piece',
        'Basic 4/4 Pulse',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C4 c4 :|',
        true
    ),
    (
        'OTIME',
        'Reel',
        'Clawhammer Drive',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'OTIME',
        'SgJig',
        'Single Jig Stride',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C3 :|',
        true
    ),
    (
        'OTIME',
        'Song',
        'Ballad Backing',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'OTIME',
        'Waltz',
        'Old-Time Waltz',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 c2 :|',
        true
    );

UPDATE public.genre_tune_type
SET
    default_bpm = v.bpm
FROM
    (
        VALUES
            -- FADO
            ('FADO', 'FadoCancao', 60),
            ('FADO', 'FadoCorrido', 100),
            ('FADO', 'FadoMenor', 50),
            -- FLAM (Flamenco)
            ('FLAM', 'Alegrias', 120),
            ('FLAM', 'Bulerias', 210),
            ('FLAM', 'Seguiriyas', 140),
            ('FLAM', 'Soleares', 100),
            -- GAME (Gamelan - Approximation)
            ('GAME', 'Pelog', 80),
            ('GAME', 'Slendro', 80),
            -- KLEZM (Klezmer)
            ('KLEZM', 'Bulgar', 130),
            ('KLEZM', 'Doina', 60), -- Usually free rhythm, giving a slow default
            ('KLEZM', 'Freylekh', 140),
            ('KLEZM', 'Khosidl', 85),
            -- NFLD (Newfoundland)
            ('NFLD', 'Air', 60),
            ('NFLD', 'JigD', 115),
            ('NFLD', 'NFLDPolska', 100),
            ('NFLD', 'NFLDSlide', 120),
            ('NFLD', 'Piece', 90),
            ('NFLD', 'Reel', 110),
            ('NFLD', 'Song', 80),
            ('NFLD', 'Waltz', 135),
            -- SAMBA
            ('SAMBA', 'SambaBatucada', 140),
            ('SAMBA', 'SambaEnredo', 140),
            ('SAMBA', 'SambaPagode', 100),
            -- SCOT (Scottish)
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
            -- TEXMX (Tex-Mex)
            ('TEXMX', 'Cumbia', 90),
            ('TEXMX', 'Ranchera', 120)
    ) AS v (genre, tune_type, bpm)
WHERE
    genre_tune_type.genre_id = v.genre
    AND genre_tune_type.tune_type_id = v.tune_type;

INSERT INTO
    public.rhythm_patterns (
        genre_id,
        tune_type_id,
        name,
        abc_string,
        is_default
    )
VALUES
    -- FADO
    (
        'FADO',
        'FadoCancao',
        'Fado 4/4 Stride',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C4 c4 :|',
        true
    ),
    (
        'FADO',
        'FadoCorrido',
        'Fado 2/4 Pulse',
        E'M:2/4\nL:1/8\nK:clef=perc\n|: C2 c2 :|',
        true
    ),
    (
        'FADO',
        'FadoMenor',
        'Sparse Slow Fado',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    -- FLAM (Flamenco - Simplified Compás mappings)
    (
        'FLAM',
        'Alegrias',
        'Alegrias 12-Beat',
        E'M:12/4\nL:1/4\nK:clef=perc\n|: c c C c c c C c C c C c :|',
        true
    ),
    (
        'FLAM',
        'Bulerias',
        'Bulerias Fast 12-Beat',
        E'M:12/8\nL:1/8\nK:clef=perc\n|: c2 C c2 c C2 c C2 C :|',
        true
    ),
    (
        'FLAM',
        'Seguiriyas',
        'Seguiriyas Pulse',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C c c C c C :|',
        true
    ),
    (
        'FLAM',
        'Soleares',
        'Soleares 12-Beat',
        E'M:12/4\nL:1/4\nK:clef=perc\n|: c c C c c c C c C c C c :|',
        true
    ),
    -- GAME (Gamelan - Cycle approximations)
    (
        'GAME',
        'Pelog',
        'Gong Cycle',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: c2 c2 c2 C2 :|',
        true
    ),
    (
        'GAME',
        'Slendro',
        'Gong Cycle',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: c2 c2 c2 C2 :|',
        true
    ),
    -- KLEZM (Klezmer)
    (
        'KLEZM',
        'Bulgar',
        'Bulgar 8-Beat Syncopation',
        E'M:8/8\nL:1/8\nK:clef=perc\n|: C3 c3 C2 :|',
        true
    ),
    (
        'KLEZM',
        'Doina',
        'Free Rhythm Drone',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'KLEZM',
        'Freylekh',
        'Freylekh Dance Pulse',
        E'M:2/4\nL:1/8\nK:clef=perc\n|: C2 c2 :|',
        true
    ),
    (
        'KLEZM',
        'Khosidl',
        'Slow Khosidl Stride',
        E'M:2/4\nL:1/8\nK:clef=perc\n|: C>c C>c :|',
        true
    ),
    -- NFLD (Newfoundland)
    (
        'NFLD',
        'Air',
        'Sparse Drone',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'NFLD',
        'JigD',
        'Double Jig',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C c c :|',
        true
    ),
    (
        'NFLD',
        'NFLDPolska',
        'Polska 3/4 Swing',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 c2 :|',
        true
    ),
    (
        'NFLD',
        'NFLDSlide',
        'Driving Slide',
        E'M:12/8\nL:1/8\nK:clef=perc\n|: C2 c C c c C2 c C c c :|',
        true
    ),
    (
        'NFLD',
        'Piece',
        '4/4 Pulse',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C4 c4 :|',
        true
    ),
    (
        'NFLD',
        'Reel',
        'Driving Reel',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'NFLD',
        'Song',
        'Song Backing',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'NFLD',
        'Waltz',
        'Waltz Flow',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 c2 :|',
        true
    ),
    -- SAMBA
    (
        'SAMBA',
        'SambaBatucada',
        'Batucada 2/4 Fast',
        E'M:2/4\nL:1/16\nK:clef=perc\n|: C2cc C2cc :|',
        true
    ),
    (
        'SAMBA',
        'SambaEnredo',
        'Enredo Pulse',
        E'M:2/4\nL:1/16\nK:clef=perc\n|: CccC cCcC :|',
        true
    ),
    (
        'SAMBA',
        'SambaPagode',
        'Pagode Groove',
        E'M:2/4\nL:1/16\nK:clef=perc\n|: C2c2 C2cc :|',
        true
    ),
    -- SCOT (Scottish)
    (
        'SCOT',
        'Air',
        'Sparse Drone',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'SCOT',
        'Hpipe',
        'Scottish Hornpipe',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C>c C>c C>c C>c :|',
        true
    ),
    (
        'SCOT',
        'JigD',
        'Double Jig',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C c c :|',
        true
    ),
    (
        'SCOT',
        'March',
        '2/4 March Driver',
        E'M:2/4\nL:1/8\nK:clef=perc\n|: C2 c2 :|',
        true
    ),
    (
        'SCOT',
        'Piece',
        '4/4 Stride',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C4 c4 :|',
        true
    ),
    (
        'SCOT',
        'Reel',
        'Scottish Reel Driver',
        E'M:4/2\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'SCOT',
        'SgJig',
        'Single Jig Stride',
        E'M:6/8\nL:1/8\nK:clef=perc\n|: C2 c C3 :|',
        true
    ),
    (
        'SCOT',
        'SlowAir',
        'Very Slow Drone',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'SCOT',
        'Song',
        'Song Backing',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C8 :|',
        true
    ),
    (
        'SCOT',
        'Strath',
        'Strathspey Snap',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C>c c<C C>c c<C :|',
        true
    ),
    (
        'SCOT',
        'Waltz',
        'Waltz Glide',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 c2 :|',
        true
    ),
    -- TEXMX (Tex-Mex)
    (
        'TEXMX',
        'Cumbia',
        'Cumbia Upbeat',
        E'M:4/4\nL:1/8\nK:clef=perc\n|: C2 c2 C2 c2 :|',
        true
    ),
    (
        'TEXMX',
        'Ranchera',
        'Ranchera 3/4 Waltz',
        E'M:3/4\nL:1/8\nK:clef=perc\n|: C2 c2 c2 :|',
        true
    );