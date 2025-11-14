import type { Template } from "~/model/template";

/**
 * Exports templates to a JSON file for download
 * @param templates - Array of templates to export
 * @param filename - Optional filename for the downloaded file
 */
export function exportTemplates(
  templates: Template[],
  filename = "templates.json",
): void {
  // Prepare the JSON data with proper formatting
  const data = JSON.stringify(templates, null, 2);

  // Create a blob with the JSON data
  const blob = new Blob([data], { type: "application/json" });

  // Create a URL for the blob
  const url = URL.createObjectURL(blob);

  // Create a temporary link element for downloading
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  // Append to body, click to download, and remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Release the URL object
  URL.revokeObjectURL(url);
}

/**
 * Validates if the imported data is a valid array of templates
 * @param data - Data to validate
 * @returns True if valid, false otherwise
 */
export function validateImportedTemplates(data: unknown): data is Template[] {
  if (!Array.isArray(data)) return false;

  // Check if every item in the array is a valid template
  return data.every((item) => {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof (item as { id: unknown }).id === "string" &&
      typeof (item as { title: unknown }).title === "string" &&
      typeof (item as { category: unknown }).category === "object" &&
      (item as { category: unknown }).category !== null &&
      typeof (item as { category: { id: unknown } }).category.id === "string" &&
      typeof (item as { category: { name: unknown } }).category.name ===
        "string" &&
      typeof (item as { category: { box_art_url: unknown } }).category
        .box_art_url === "string" &&
      Array.isArray((item as { tags: unknown }).tags) &&
      (item as { tags: unknown[] }).tags.every((tag) => typeof tag === "string")
    );
  });
}

/**
 * Imports templates from a file
 * @returns Promise that resolves to an array of templates or rejects with an error
 */
export function importTemplates(): Promise<Template[]> {
  return new Promise<Template[]>((resolve, reject) => {
    // Create a file input element
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json";

    // Set up the file change handler
    fileInput.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) {
        reject(new Error("No file selected"));
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          if (!validateImportedTemplates(data)) {
            reject(new Error("Invalid template format"));
            return;
          }

          resolve(data);
        } catch (_error) {
          reject(new Error("Failed to parse file"));
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsText(file);
    };

    // Trigger the file input click
    fileInput.click();
  });
}
