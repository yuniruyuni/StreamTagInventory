// A label for content classification.
// Twitch requires us a streaming content is suitable for what by using this label.
// CCL stands for Content Classification Label.
export type CCL = {
  id: string;
  description: string;
  name: string;
};

// CCLSelection is a selected CCL id.
export type CCLSelection = string;
