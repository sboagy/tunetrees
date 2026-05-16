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

INSERT INTO
    public.rhythm_patterns (
        genre_id,
        tune_type_id,
        name,
        part_target,
        abc_string,
        is_default,
        premium_audio_url,
        sample_kit,
        pattern_type
    )
VALUES
    ('BGRA', 'Breakdown', 'Fast Bluegrass Drive', '*', 'M:2/2
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('BGRA', 'JigD', 'Bluegrass Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('BGRA', 'Piece', 'Bluegrass 4/4 Stride', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'),
    ('BGRA', 'Reel', 'Bluegrass Reel', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('BGRA', 'Song', 'Folk Song Chug', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 C2 c4 :|', true, NULL, 'bodhran', 'seed'),
    ('BGRA', 'Waltz', 'Fast Bluegrass Waltz', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('BLUES', 'BluesShuffle', 'Heavy 12/8 Shuffle', '*', 'M:12/8
L:1/8
K:clef=perc
|: C2 c C c c C2 c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('BLUES', 'DeltaBlues', 'Delta Stomp', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c2 C2 :|', true, NULL, 'bodhran', 'seed'),
    ('CAJUN', 'TwoStep', 'Cajun Two-Step', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('CAJUN', 'WaltzCajun', 'Cajun Waltz Swing', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('CONTRA', 'JigD', 'Contra Double Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('CONTRA', 'Mzrka', 'Contra Mazurka', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 C2 :|', true, NULL, 'bodhran', 'seed'),
    ('CONTRA', 'Polka', 'Contra Polka Jump', '*', 'M:2/4
L:1/8
K:clef=perc
|: C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('CONTRA', 'Reel', 'Contra Driving Reel', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('CONTRA', 'Schot', 'Contra Schottische', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'),
    ('CONTRA', 'Waltz', 'Contra Waltz Glide', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('FADO', 'FadoCancao', 'Fado 4/4 Stride', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'),
    ('FADO', 'FadoCorrido', 'Fado 2/4 Pulse', '*', 'M:2/4
L:1/8
K:clef=perc
|: C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('FADO', 'FadoMenor', 'Sparse Slow Fado', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('FLAM', 'Alegrias', 'Alegrias 12-Beat', '*', 'M:12/4
L:1/4
K:clef=perc
|: c c C c c c C c C c C c :|', true, NULL, 'bodhran', 'seed'),
    ('FLAM', 'Bulerias', 'Bulerias Fast 12-Beat', '*', 'M:12/8
L:1/8
K:clef=perc
|: c2 C c2 c C2 c C2 C :|', true, NULL, 'bodhran', 'seed'),
    ('FLAM', 'Seguiriyas', 'Seguiriyas Pulse', '*', 'M:3/4
L:1/8
K:clef=perc
|: C c c C c C :|', true, NULL, 'bodhran', 'seed'),
    ('FLAM', 'Soleares', 'Soleares 12-Beat', '*', 'M:12/4
L:1/4
K:clef=perc
|: c c C c c c C c C c C c :|', true, NULL, 'bodhran', 'seed'),
    ('FRCAN', 'Air', 'Sparse Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('FRCAN', 'Branle', 'Branle Stride', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('FRCAN', 'JigD', 'Quebecois 6/8', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('FRCAN', 'Piece', 'Marching Pulse', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'),
    ('FRCAN', 'Quadrille', 'Quadrille Bounce', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('FRCAN', 'Reel', 'Crooked Reel Driver', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('FRCAN', 'Song', 'Chanson Backing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('FRCAN', 'Waltz', 'Valse Swing', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('GAME', 'Pelog', 'Gong Cycle', '*', 'M:4/4
L:1/8
K:clef=perc
|: c2 c2 c2 C2 :|', true, NULL, 'bodhran', 'seed'),
    ('GAME', 'Slendro', 'Gong Cycle', '*', 'M:4/4
L:1/8
K:clef=perc
|: c2 c2 c2 C2 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Air', 'Sparse Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'BDnce', 'Barn Dance Flow', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Hland', 'Highland Swing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Hpipe', 'Hornpipe Swung', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'JigD', 'Standard Double Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2c Ccc | C2c Ccc | C2c Ccc | ccc Ccc :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'JigSl', 'Standard Slip Jig', '*', 'M:9/8
L:1/8
K:clef=perc
|: C2 c C c c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Mzrka', 'Mazurka Pulse', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 C2 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Piece', 'Basic 4/4 March', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Polka', 'Upbeat Polka', '*', 'M:2/4
L:1/8
K:clef=perc
|: C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Reel', 'Standard Driving Reel', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Schot', 'Schottische Bounce', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'SetD', 'Set Dance Driver', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'SgJig', 'Single Jig Stride', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C3 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'SgReel', 'Single Reel Pulse', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Slide', 'Driving Slide', '*', 'M:12/8
L:1/8
K:clef=perc
|: C2 c C c c C2 c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Song', 'Sparse Vocal Backing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Strath', 'Strathspey Snap', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c c<C C>c c<C :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'three-two', '3/2 Hornpipe Pulse', '*', 'M:3/2
L:1/8
K:clef=perc
|: C4 c4 c4 :|', true, NULL, 'bodhran', 'seed'),
    ('ITRAD', 'Waltz', 'Irish Waltz Flow', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('KLEZM', 'Bulgar', 'Bulgar 8-Beat Syncopation', '*', 'M:8/8
L:1/8
K:clef=perc
|: C3 c3 C2 :|', true, NULL, 'bodhran', 'seed'),
    ('KLEZM', 'Doina', 'Free Rhythm Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('KLEZM', 'Freylekh', 'Freylekh Dance Pulse', '*', 'M:2/4
L:1/8
K:clef=perc
|: C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('KLEZM', 'Khosidl', 'Slow Khosidl Stride', '*', 'M:2/4
L:1/8
K:clef=perc
|: C>c C>c :|', true, NULL, 'bodhran', 'seed'),
    ('NFLD', 'Air', 'Sparse Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('NFLD', 'JigD', 'Double Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('NFLD', 'NFLDPolska', 'Polska 3/4 Swing', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('NFLD', 'NFLDSlide', 'Driving Slide', '*', 'M:12/8
L:1/8
K:clef=perc
|: C2 c C c c C2 c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('NFLD', 'Piece', '4/4 Pulse', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'),
    ('NFLD', 'Reel', 'Driving Reel', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('NFLD', 'Song', 'Song Backing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('NFLD', 'Waltz', 'Waltz Flow', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('OTIME', 'Air', 'Sparse Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('OTIME', 'Hpipe', 'Old-Time Hornpipe', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'),
    ('OTIME', 'JigD', 'Old-Time Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('OTIME', 'Piece', 'Basic 4/4 Pulse', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'),
    ('OTIME', 'Reel', 'Clawhammer Drive', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('OTIME', 'SgJig', 'Single Jig Stride', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C3 :|', true, NULL, 'bodhran', 'seed'),
    ('OTIME', 'Song', 'Ballad Backing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('OTIME', 'Waltz', 'Old-Time Waltz', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('SAMBA', 'SambaBatucada', 'Batucada 2/4 Fast', '*', 'M:2/4
L:1/16
K:clef=perc
|: C2cc C2cc :|', true, NULL, 'bodhran', 'seed'),
    ('SAMBA', 'SambaEnredo', 'Enredo Pulse', '*', 'M:2/4
L:1/16
K:clef=perc
|: CccC cCcC :|', true, NULL, 'bodhran', 'seed'),
    ('SAMBA', 'SambaPagode', 'Pagode Groove', '*', 'M:2/4
L:1/16
K:clef=perc
|: C2c2 C2cc :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'Air', 'Sparse Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'Hpipe', 'Scottish Hornpipe', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c C>c C>c C>c :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'JigD', 'Double Jig', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C c c :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'March', '2/4 March Driver', '*', 'M:2/4
L:1/8
K:clef=perc
|: C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'Piece', '4/4 Stride', '*', 'M:4/4
L:1/8
K:clef=perc
|: C4 c4 :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'Reel', 'Scottish Reel Driver', '*', 'M:4/2
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'SgJig', 'Single Jig Stride', '*', 'M:6/8
L:1/8
K:clef=perc
|: C2 c C3 :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'SlowAir', 'Very Slow Drone', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'Song', 'Song Backing', '*', 'M:4/4
L:1/8
K:clef=perc
|: C8 :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'Strath', 'Strathspey Snap', '*', 'M:4/4
L:1/8
K:clef=perc
|: C>c c<C C>c c<C :|', true, NULL, 'bodhran', 'seed'),
    ('SCOT', 'Waltz', 'Waltz Glide', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('TEXMX', 'Cumbia', 'Cumbia Upbeat', '*', 'M:4/4
L:1/8
K:clef=perc
|: C2 c2 C2 c2 :|', true, NULL, 'bodhran', 'seed'),
    ('TEXMX', 'Ranchera', 'Ranchera 3/4 Waltz', '*', 'M:3/4
L:1/8
K:clef=perc
|: C2 c2 c2 :|', true, NULL, 'bodhran', 'seed');
