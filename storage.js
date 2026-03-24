(function () {
  const primaryStorageKey = "maylin-questionnaires";
  const legacyStorageKeys = [
    primaryStorageKey,
    "maylin_questionnaires",
    "maylinQuestionnaires",
    "questionnaires",
  ];

  const createEntryId = () =>
    window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const normalizeText = (value) => String(value ?? "").trim();

  const normalizeEntry = (entry = {}) => ({
    id: normalizeText(entry.id) || createEntryId(),
    createdAt:
      normalizeText(entry.createdAt) ||
      normalizeText(entry.created_at) ||
      new Date().toISOString(),
    name: normalizeText(entry.name) || normalizeText(entry.fullName),
    email: normalizeText(entry.email),
    phone: normalizeText(entry.phone) || normalizeText(entry.phoneNumber),
    deliveryArea:
      normalizeText(entry.deliveryArea) ||
      normalizeText(entry.delivery_area) ||
      normalizeText(entry.area),
    message:
      normalizeText(entry.message) ||
      normalizeText(entry.notes) ||
      normalizeText(entry.comment),
    source: normalizeText(entry.source) || "website-questionnaire",
  });

  const sortEntries = (entries) =>
    [...entries].sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );

  const getRawEntries = (key) => {
    try {
      const storedEntries = window.localStorage.getItem(key);

      if (!storedEntries) {
        return [];
      }

      const parsedEntries = JSON.parse(storedEntries);
      return Array.isArray(parsedEntries) ? parsedEntries : [];
    } catch {
      return [];
    }
  };

  const getMergedEntries = () => {
    const entryMap = new Map();

    legacyStorageKeys.forEach((key) => {
      getRawEntries(key).forEach((entry) => {
        const normalizedEntry = normalizeEntry(entry);
        const dedupeKey =
          normalizedEntry.id ||
          `${normalizedEntry.email}-${normalizedEntry.createdAt}-${normalizedEntry.name}`;
        entryMap.set(dedupeKey, normalizedEntry);
      });
    });

    return sortEntries(Array.from(entryMap.values()));
  };

  const persistEntries = (entries) => {
    const normalizedEntries = sortEntries(entries.map(normalizeEntry));
    window.localStorage.setItem(primaryStorageKey, JSON.stringify(normalizedEntries));

    legacyStorageKeys
      .filter((key) => key !== primaryStorageKey)
      .forEach((key) => window.localStorage.removeItem(key));

    return normalizedEntries;
  };

  const listQuestionnaires = () => {
    const normalizedEntries = getMergedEntries();
    persistEntries(normalizedEntries);
    return normalizedEntries;
  };

  const saveQuestionnaire = (entry) => {
    const currentEntries = listQuestionnaires();
    const nextEntries = [normalizeEntry(entry), ...currentEntries];
    return persistEntries(nextEntries)[0];
  };

  window.maylinStorageApi = {
    createEntryId,
    listQuestionnaires,
    normalizeEntry,
    saveQuestionnaire,
    storageKey: primaryStorageKey,
  };
})();
