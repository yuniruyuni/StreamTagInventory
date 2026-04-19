import * as templateDoc from "./templateDoc";

export type Repos = {
  templateDoc: templateDoc.TemplateDocRepository;
};

export function createRawRepos(): Repos {
  return {
    templateDoc: templateDoc.createDefault(),
  };
}
