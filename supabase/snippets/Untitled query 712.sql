-- 1) Which tune_ref values are duplicated?
SELECT
  tune_ref,
  COUNT(*) AS row_count
FROM public.tune_override
GROUP BY tune_ref
HAVING COUNT(*) > 1
ORDER BY row_count DESC, tune_ref;