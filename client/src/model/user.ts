export type User = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
};

export function newUser(): User {
  return {
    id: "",
    login: "",
    display_name: "",
    profile_image_url: "",
  };
}

export const EmptyUser = newUser();
