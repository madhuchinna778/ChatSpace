const API_URL = "http://127.0.0.1:5000";

export async function checkBackend() {
  try {
    const response = await fetch(`${API_URL}/api/health`);

    if (!response.ok) {
      throw new Error("Backend request failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Backend connection error:", error);
    throw error;
  }
}