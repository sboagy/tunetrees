-- Insert genre-tune type associations
INSERT INTO genre_tune_type (genre_id, tune_type_id) VALUES

-- NFLD
('NFLD', 'NFLDSlide'),
('NFLD', 'NFLDPolska'),
('NFLD', 'Reel'), -- Assuming some overlap with Irish tradition
('NFLD', 'JigD'),
('NFLD', 'Waltz'),
('NFLD', 'Piece'),
('NFLD', 'Song'),
('NFLD', 'Air');

INSERT INTO genre_tune_type (genre_id, tune_type_id) VALUES
('KLEZM', 'Freylekh'),
('KLEZM', 'Khosidl'),
('KLEZM', 'Doina'),
('KLEZM', 'Bulgar');

INSERT INTO genre_tune_type (genre_id, tune_type_id) VALUES
('FLAM', 'Soleares'),
('FLAM', 'Alegrias'),
('FLAM', 'Bulerias'),
('FLAM', 'Seguiriyas');

INSERT INTO genre_tune_type (genre_id, tune_type_id) VALUES
('BLUES', 'BluesShuffle'),
('BLUES', 'BluesBallad'),
('BLUES', 'DeltaBlues');

INSERT INTO genre_tune_type (genre_id, tune_type_id) VALUES
('CAJUN', 'TwoStep'),
('CAJUN', 'WaltzCajun');

INSERT INTO genre_tune_type (genre_id, tune_type_id) VALUES
('TEXMX', 'Cumbia'),
('TEXMX', 'Ranchera');

INSERT INTO genre_tune_type (genre_id, tune_type_id) VALUES
('SAMBA', 'SambaBatucada'),
('SAMBA', 'SambaPagode'),
('SAMBA', 'SambaEnredo');

INSERT INTO genre_tune_type (genre_id, tune_type_id) VALUES
('GAME', 'Slendro'),
('GAME', 'Pelog');


-- Insert genre-tune type associations
INSERT INTO
    genre_tune_type (genre_id, tune_type_id)
VALUES
    -- ITRAD (already provided)
    -- OTIME (assumes significant overlap with ITRAD)
    ('OTIME', 'Reel'),
    ('OTIME', 'Hpipe'),
    ('OTIME', 'JigD'),
    ('OTIME', 'SgJig'),
    ('OTIME', 'Waltz'),
    ('OTIME', 'Piece'),
    ('OTIME', 'Song'),
    ('OTIME', 'Air'),
    -- BGRA (similar to OTIME, with Breakdown added)
    ('BGRA', 'Reel'),
    ('BGRA', 'JigD'),
    ('BGRA', 'Waltz'),
    ('BGRA', 'Breakdown'),
    ('BGRA', 'Piece'),
    ('BGRA', 'Song'),
    -- CONTRA (focus on dance tunes)
    ('CONTRA', 'Reel'),
    ('CONTRA', 'JigD'),
    ('CONTRA', 'Waltz'),
    ('CONTRA', 'Polka'),
    ('CONTRA', 'Schot'),
    ('CONTRA', 'Mzrka'),
    -- FRCAN (some overlap with ITRAD, plus Branle and Quadrille)
    ('FRCAN', 'Reel'),
    ('FRCAN', 'JigD'),
    ('FRCAN', 'Waltz'),
    ('FRCAN', 'Branle'),
    ('FRCAN', 'Quadrille'),
    ('FRCAN', 'Piece'),
    ('FRCAN', 'Song'),
    ('FRCAN', 'Air'),
    -- SCOT (similar to ITRAD, with March and Slow Air added)
    ('SCOT', 'Reel'),
    ('SCOT', 'Hpipe'),
    ('SCOT', 'JigD'),
    ('SCOT', 'SgJig'),
    ('SCOT', 'Strath'),
    ('SCOT', 'Waltz'),
    ('SCOT', 'Piece'),
    ('SCOT', 'Song'),
    ('SCOT', 'Air'),
    ('SCOT', 'March'),
    ('SCOT', 'SlowAir'),
    -- NFLD (assumes overlap with ITRAD, but might have unique types)
    ('NFLD', 'Reel'),
    ('NFLD', 'JigD'),
    ('NFLD', 'Waltz'),
    ('NFLD', 'Piece'),
    ('NFLD', 'Song'),
    ('NFLD', 'Air'),
	('FADO', 'FadoCorrido'),
	('FADO', 'FadoMenor'),
	('FADO', 'FadoCancao');