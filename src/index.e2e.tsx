// E2E Test entry point - set up mock providers before loading app
import { setApiClient } from "./api";
import { setAuthProvider } from "./auth";
import { MockApiClient } from "../e2e/mocks/mockApiClient";
import { MockAuthProvider } from "../e2e/mocks/mockAuthProvider";

// In E2E mode, always use mock providers
setApiClient(new MockApiClient());
setAuthProvider(new MockAuthProvider());

// Load the main application
import "./index";