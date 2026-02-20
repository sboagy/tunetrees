-- 2) Show the actual duplicate rows
WITH dup AS (
  SELECT tune_ref
  FROM public.tune_override
  GROUP BY tune_ref
  HAVING COUNT(*) > 1
)
SELECT t.*
FROM public.tune_override t
JOIN dup d ON d.tune_ref = t.tune_ref
ORDER BY t.tune_ref, t.user_ref;