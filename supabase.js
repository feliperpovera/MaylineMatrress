(function () {
  const config = window.SUPABASE_CONFIG || {};
  const localStorageKey = "maylin-questionnaires";
  const placeholderValues = ["YOUR_SUPABASE_URL", "YOUR_SUPABASE_ANON_KEY"];
  const isConfigured =
    Boolean(config.url) &&
    Boolean(config.anonKey) &&
    !placeholderValues.includes(config.url) &&
    !placeholderValues.includes(config.anonKey) &&
    Boolean(window.supabase?.createClient);

  const getTableName = () => config.questionnairesTable || "questionnaires";

  const normalizeEntry = (entry) => ({
    id: entry.id,
    createdAt: entry.created_at || entry.createdAt || new Date().toISOString(),
    name: entry.name || "",
    email: entry.email || "",
    phone: entry.phone || "",
    deliveryArea: entry.delivery_area || entry.deliveryArea || "",
    message: entry.message || "",
    source: entry.source || "website-questionnaire",
  });

  const getLocalEntries = () => {
    try {
      const storedEntries = window.localStorage.getItem(localStorageKey);

      if (!storedEntries) {
        return [];
      }

      const parsedEntries = JSON.parse(storedEntries);
      return Array.isArray(parsedEntries) ? parsedEntries.map(normalizeEntry) : [];
    } catch {
      return [];
    }
  };

  const saveLocalEntry = (entry) => {
    const entries = getLocalEntries();
    entries.unshift(normalizeEntry(entry));
    window.localStorage.setItem(localStorageKey, JSON.stringify(entries));
    return normalizeEntry(entry);
  };

  const createEntryId = () =>
    window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const client = isConfigured
    ? window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

  const saveQuestionnaire = async (entry) => {
    const normalizedEntry = normalizeEntry(entry);

    if (!client) {
      return saveLocalEntry({
        ...normalizedEntry,
        id: normalizedEntry.id || createEntryId(),
      });
    }

    const payload = {
      name: normalizedEntry.name,
      email: normalizedEntry.email,
      phone: normalizedEntry.phone || null,
      delivery_area: normalizedEntry.deliveryArea,
      message: normalizedEntry.message,
      source: normalizedEntry.source || "website-questionnaire",
    };

    const { data, error } = await client.from(getTableName()).insert(payload).select().single();

    if (error) {
      throw error;
    }

    return normalizeEntry(data);
  };

  const listQuestionnaires = async () => {
    if (!client) {
      return getLocalEntries();
    }

    const { data, error } = await client
      .from(getTableName())
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(normalizeEntry);
  };

  const signIn = async ({ email, password }) => {
    if (!client) {
      throw new Error("Supabase is not configured.");
    }

    return client.auth.signInWithPassword({ email, password });
  };

  const signUp = async ({ email, password, metadata = {} }) => {
    if (!client) {
      throw new Error("Supabase is not configured.");
    }

    return client.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
  };

  const signOut = async () => {
    if (!client) {
      return { error: null };
    }

    return client.auth.signOut();
  };

  const getSession = async () => {
    if (!client) {
      return { data: { session: null }, error: new Error("Supabase is not configured.") };
    }

    return client.auth.getSession();
  };

  const onAuthStateChange = (callback) => {
    if (!client) {
      return { data: { subscription: { unsubscribe() {} } } };
    }

    return client.auth.onAuthStateChange(callback);
  };

  window.maylinDataApi = {
    allowPortalSignup: Boolean(config.allowPortalSignup),
    client,
    isConfigured,
    listQuestionnaires,
    saveQuestionnaire,
    signIn,
    signOut,
    signUp,
    getSession,
    onAuthStateChange,
  };
})();
