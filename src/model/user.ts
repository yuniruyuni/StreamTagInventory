export type User = {
  id: string;
  display_name: string;
  profile_image_url: string;
};

export function newUser(): User {
  return {
    id: "",
    display_name: "",
    profile_image_url: "",
  };
}

export const EmptyUser = newUser();
