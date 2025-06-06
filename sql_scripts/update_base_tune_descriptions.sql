UPDATE tune_type SET description = 
CASE id
    WHEN 'Reel' THEN 'A lively dance tune in 4/4 time, often played at a fast tempo.'
    WHEN 'Hpipe' THEN 'A moderately paced dance tune in 4/4 time, with a distinctive dotted rhythm.'
    WHEN 'JigD' THEN 'A lively dance tune in 6/8 time, often with a triple feel.'
    WHEN 'SgJig' THEN 'A single jig in 6/8 time, typically with a more relaxed tempo than a double jig.'
    WHEN 'JigSl' THEN 'A flowing dance tune in 9/8 time, with a distinctive rhythm and feel.'
    WHEN 'Slide' THEN 'A dance tune in 12/8 time, often with a smooth, gliding feel.'
    WHEN 'SetD' THEN 'A type of social dance with a specific set of figures, often with a lively and rhythmic character.'
    WHEN 'SgReel' THEN 'A single reel in 2/4 time, typically played at a slower tempo than a double reel.'
    WHEN 'Polka' THEN 'A lively dance tune in 2/4 time, with a distinctive "oom-pah-pah" rhythm.'
    WHEN 'BDnce' THEN 'A lively dance tune in 4/4 time, suitable for various social dances and often with a simple structure.'
    WHEN 'Schot' THEN 'A partnered dance with a distinctive rhythm, often in 4/4 time with a "hop-step-close" pattern.'
    WHEN 'Hland' THEN 'A lively Scottish solo dance, typically in 4/4 time with a distinctive rhythm and steps.'
    WHEN 'Strath' THEN 'A Scottish dance tune in 4/4 time with a distinctive dotted rhythm and a "Scotch snap" feel.'
    WHEN 'Mzrka' THEN 'A Polish folk dance in 3/4 time, with a distinctive accent on the second or third beat.'
    WHEN 'Waltz' THEN 'A graceful dance tune in 3/4 time, with a smooth, flowing feel.'
    WHEN 'Piece' THEN 'A general term for a musical composition, often with a more free-form structure.'
    WHEN 'Song' THEN 'A musical piece with lyrics, often with a focus on melody and emotional expression.'
    WHEN 'Air' THEN 'A slow, lyrical tune, often with a melancholic or reflective mood.'
    ELSE description -- Keep the existing description if no match is found
END;