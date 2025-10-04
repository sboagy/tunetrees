export function deepEqualIgnoreOrder(
  obj1: unknown,
  obj2: unknown,
  ignoreArrayOrder = true,
): boolean {
  if (obj1 === obj2) return true;
  if (
    typeof obj1 !== "object" ||
    typeof obj2 !== "object" ||
    obj1 === null ||
    obj2 === null
  ) {
    return obj1 === obj2;
  }

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    if (ignoreArrayOrder) {
      const arr2Copy = [...obj2];
      for (const element1 of obj1) {
        const matchIndex = arr2Copy.findIndex((element2) =>
          deepEqualIgnoreOrder(element1, element2, true),
        );
        if (matchIndex === -1) return false;
        arr2Copy.splice(matchIndex, 1);
      }
      return arr2Copy.length === 0;
    }
    for (const [i, element] of obj1.entries()) {
      if (!deepEqualIgnoreOrder(element, obj2[i], false)) return false;
    }
    return true;
  }

  const keys1 = Object.keys(obj1 as Record<string, unknown>).sort();
  const keys2 = Object.keys(obj2 as Record<string, unknown>).sort();
  if (keys1.length !== keys2.length) return false;
  for (const [i, key] of keys1.entries()) {
    if (key !== keys2[i]) return false;
    if (
      !deepEqualIgnoreOrder(
        (obj1 as Record<string, unknown>)[key],
        (obj2 as Record<string, unknown>)[keys2[i]],
        ignoreArrayOrder,
      )
    ) {
      return false;
    }
  }
  return true;
}
