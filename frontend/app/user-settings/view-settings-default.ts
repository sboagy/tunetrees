export const viewSettingsDefault = {
  practice_pane: {
    column_settings: {
      id: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      title: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      type: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      structure: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      mode: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      incipit: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      learned: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      practiced: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      quality: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      easiness: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      interval: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      repetitions: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      review_date: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      backup_practiced: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      external_ref: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      note_private: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      note_public: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      tags: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      },
      recall_eval: {
        sort_direction: null, // null, "asc", "desc"
        visible: false,
        enabled: true, // is this column enabled at all for this table?
      }, // Note: Columns with `id` instead of `accessorKey` are not included in the dictionary
    },
  },
  repertoire_pane: {
    column_settings: ["title", "key", "time_signature", "tempo"],
  },
  analysis_pane: {
    column_settings: ["title", "key", "time_signature", "tempo"],
  },
};

export const viewSettingsDefaultString = JSON.stringify(viewSettingsDefault);
