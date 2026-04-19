import * as templateDoc from "./templateDoc";
import * as user from "./user";

export type Repos = {
  user: user.UserRepository;
  templateDoc: templateDoc.TemplateDocRepository;
};

export function createRawRepos(): Repos {
  return {
    user: user.createDefault(),
    templateDoc: templateDoc.createDefault(),
  };
}
