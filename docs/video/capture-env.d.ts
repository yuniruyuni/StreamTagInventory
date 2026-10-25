// Synthetic authentication token installed by the video capture test helper.
export {};
declare global {
  interface Window {
    __mockAuthToken?: string;
  }
}
