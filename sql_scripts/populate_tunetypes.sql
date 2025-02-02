-- NFLD (Music of Newfoundland and Labrador) - Might have unique types
INSERT INTO tune_type (id, name, rhythm, description) VALUES
('NFLDSlide', 'Newfoundland Slide', NULL, 'A slide specific to Newfoundland music.'),
('NFLDPolska', 'Newfoundland Polka', '2/4', 'A polka adapted to Newfoundland style.');

-- KLEZM (Klezmer Music)
INSERT INTO tune_type (id, name, rhythm, description) VALUES
('Freylekh', 'Freylekh', NULL, 'A lively, improvisational dance tune in Klezmer music.'),
('Khosidl', 'Khosidl', NULL, 'A slow, lyrical tune in Klezmer music.'),
('Doina', 'Doina', NULL, 'A melancholic, improvisational tune in Klezmer music.'),
('Bulgar', 'Bulgar', NULL, 'A dance tune in Klezmer music with a distinctive rhythm.');

-- FLAM (Flamenco)
INSERT INTO tune_type (id, name, rhythm, description) VALUES
('Soleares', 'Soleares', NULL, 'A fundamental form in Flamenco music, often with a 12-beat cycle.'),
('Alegrias', 'Alegrias', NULL, 'A festive and rhythmic form in Flamenco music.'),
('Bulerias', 'Bulerias', NULL, 'A fast and improvisational form in Flamenco music.'),
('Seguiriyas', 'Seguiriyas', NULL, 'A serious and dramatic form in Flamenco music.');

-- BLUES (Blues)
INSERT INTO tune_type (id, name, rhythm, description) VALUES
('BluesShuffle', 'Blues Shuffle', NULL, 'A rhythmic pattern with a "swung" feel, common in blues music.'),
('Blues Ballad', 'Blues Ballad', NULL, 'A slow, lyrical blues song.'),
('DeltaBlues', 'Delta Blues', NULL, 'A style of blues originating in the Mississippi Delta.');

-- CAJUN (Cajun Music)
INSERT INTO tune_type (id, name, rhythm, description) VALUES
('TwoStep', 'Two-Step', NULL, 'A Cajun dance tune with a two-step rhythm.'),
('WaltzCajun', 'Cajun Waltz', '3/4', 'A waltz adapted to Cajun style.');

-- TEXMX (Tex-Mex Music)
INSERT INTO tune_type (id, name, rhythm, description) VALUES
('Cumbia', 'Cumbia', NULL, 'A Colombian dance rhythm popular in Tex-Mex music.'),
('Ranchera', 'Ranchera', NULL, 'A Mexican song form with a distinctive rhythm and often with themes of love and loss.');

-- SAMBA (Samba)
INSERT INTO tune_type (id, name, rhythm, description) VALUES
('SambaBatucada', 'Samba Batucada', NULL, 'A samba style with a strong percussion focus.'),
('SambaPagode', 'Samba Pagode', NULL, 'A more intimate and lyrical samba style.'),
('SambaEnredo', 'Samba Enredo', NULL, 'A samba style used in Carnival parades with elaborate themes and lyrics.');

-- GAME (Gamelan)
INSERT INTO tune_type (id, name, rhythm, description) VALUES
('Slendro', 'Slendro', NULL, 'A five-note scale commonly used in Gamelan music.'),
('Pelog', 'Pelog', NULL, 'A seven-note scale commonly used in Gamelan music.');


INSERT INTO tune_type (id, name, rhythm, description) VALUES
('FadoCorrido', 'Fado (Corrido)', NULL, 'Rhythmic and faster-paced Fado style.'),
('FadoMenor', 'Fado (Menor)', NULL, 'Slower and more melancholic Fado style.'),
('FadoCancao', 'Fado (Canção)', NULL, 'Contemporary Fado style with influences from popular song forms.')

INSERT INTO
    tune_type (id, name, rhythm, description)
VALUES
    (
        'Breakdown',
        'Breakdown',
        NULL,
        'A fast, energetic tune common in bluegrass music.'
    ), -- Added for BGRA
    (
        'Branle',
        'Branle',
        NULL,
        'A type of French folk dance.'
    ), -- Added for FRCAN
    (
        'Quadrille',
        'Quadrille',
        NULL,
        'A type of French square dance.'
    ), -- Added for FRCAN
    (
        'March',
        'March',
        '4/4',
        'A tune with a strong, regular beat, often used for marching.'
    ), -- Added for SCOT
    (
        'SlowAir',
        'Slow Air',
        NULL,
        'A slow, melancholic tune.'
    ) -- Added for SCOT;
	('FadoCorrido', 'Fado (Corrido)', NULL, 'Rhythmic and faster-paced Fado style.'),
	('FadoMenor', 'Fado (Menor)', NULL, 'Slower and more melancholic Fado style.'),
	('FadoCancao', 'Fado (Canção)', NULL, 'Contemporary Fado style with influences from popular song forms.')
    -- INSERT INTO tune_type (id, name, rhythm, description) VALUES
    -- ('Reel', 'Reel', '4/4', 'A lively dance tune in 4/4 time.'),
    -- ('Hpipe', 'Hornpipe', '4/4', 'A moderately paced dance tune in 4/4 time.'),
    -- ('JigD', 'Jig', '6/8', 'A lively dance tune in 6/8 time.'),
    -- ('SgJig', 'Jig (Single)', '6/8', 'A single jig in 6/8 time.'),
    -- ('JigSl', 'Slip Jig', '9/8', 'A flowing dance tune in 9/8 time.'),
    -- ('Slide', 'Slide', '12/8', 'A dance tune in 12/8 time.'),
    -- ('SetD', 'Set Dance', NULL, 'A type of dance with a specific set of figures.'),
    -- ('SgReel', 'Single Reel', '2/4', 'A single reel in 2/4 time.'),
    -- ('Polka', 'Polka', '2/4', 'A lively dance tune in 2/4 time.'),
    -- ('BDnce', 'Barn Dance', '4/4', 'A lively dance tune in 4/4 time.'),
    -- ('Schot', 'Schottische', NULL, 'A partnered dance with a distinctive rhythm.'),
    -- ('Hland', 'Highland Fling', NULL, 'A lively Scottish solo dance.'),
    -- ('Strath', 'Strathspey', '4/4', 'A Scottish dance tune in 4/4 time with a distinctive rhythm.'),
    -- ('Mzrka', 'Mazurka', '3/4', 'A Polish folk dance in 3/4 time.'),
    -- ('Waltz', 'Waltz', '3/4', 'A dance tune in 3/4 time.'),
    -- ('Piece', 'Piece', NULL, 'A general term for a musical composition.'),
    -- ('Song', 'Song', NULL, 'A musical piece with lyrics.'),
    -- ('Air', 'Air', NULL, 'A slow, lyrical tune.'),
    -- ('Breakdown', 'Breakdown', NULL, 'A fast, energetic tune common in bluegrass music.'), -- Added for BGRA
    -- ('Branle', 'Branle', NULL, 'A type of French folk dance.'), -- Added for FRCAN
    -- ('Quadrille', 'Quadrille', NULL, 'A type of French square dance.'), -- Added for FRCAN
    -- ('March', 'March', '4/4', 'A tune with a strong, regular beat, often used for marching.'), -- Added for SCOT
    -- ('SlowAir', 'Slow Air', NULL, 'A slow, melancholic tune.') -- Added for SCOT;