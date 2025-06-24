// Mock data for E2E tests
export const mockUser = {
  id: "12345",
  login: "testuser",
  display_name: "Test User",
  type: "",
  broadcaster_type: "affiliate",
  description: "Test channel description",
  profile_image_url: "https://example.com/profile.png",
  offline_image_url: "",
  view_count: 12345,
  email: "test@example.com",
  created_at: "2020-01-01T00:00:00Z",
};

export const mockChannel = {
  broadcaster_id: "12345",
  broadcaster_login: "testuser",
  broadcaster_name: "Test User",
  broadcaster_language: "en",
  game_id: "509658",
  game_name: "Just Chatting",
  title: "Test Stream Title",
  delay: 0,
  tags: ["English", "Gaming"],
  content_classification_labels: [],
  is_branded_content: false,
};

export const mockCategories = [
  {
    id: "509658",
    name: "Just Chatting",
    box_art_url:
      "https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg",
    igdb_id: "",
  },
  {
    id: "21779",
    name: "League of Legends",
    box_art_url:
      "https://static-cdn.jtvnw.net/ttv-boxart/21779-{width}x{height}.jpg",
    igdb_id: "115",
  },
  {
    id: "32982",
    name: "Grand Theft Auto V",
    box_art_url:
      "https://static-cdn.jtvnw.net/ttv-boxart/32982-{width}x{height}.jpg",
    igdb_id: "1020",
  },
];

export const mockTags = [
  {
    tag_id: "6ea6bca4-4712-4ab9-a906-e3336a9d8039",
    is_auto: false,
    localization_names: {
      "en-us": "English",
    },
    localization_descriptions: {
      "en-us": "For streams in English",
    },
  },
  {
    tag_id: "d72ce8e8-cf5f-4669-a5ba-5d88e5c0d5e0",
    is_auto: false,
    localization_names: {
      "en-us": "Gaming",
    },
    localization_descriptions: {
      "en-us": "For gaming streams",
    },
  },
  {
    tag_id: "f588bd74-e496-4d11-9169-3597f38a5d25",
    is_auto: false,
    localization_names: {
      "en-us": "Tutorial",
    },
    localization_descriptions: {
      "en-us": "For tutorial streams",
    },
  },
];
