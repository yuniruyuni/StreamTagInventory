import * as oidcNonce from "./oidcNonce";
import * as session from "./session";
import * as templateDoc from "./templateDoc";
import * as user from "./user";

export type Repos = {
  user: user.UserRepository;
  session: session.SessionRepository;
  oidcNonce: oidcNonce.OidcNonceRepository;
  templateDoc: templateDoc.TemplateDocRepository;
};

export function createRawRepos(): Repos {
  return {
    user: user.createDefault(),
    session: session.createDefault(),
    oidcNonce: oidcNonce.createDefault(),
    templateDoc: templateDoc.createDefault(),
  };
}
