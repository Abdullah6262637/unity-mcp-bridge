import dotenv from 'dotenv';
dotenv.config();

const UNITY_HOST = process.env.UNITY_HOST || '127.0.0.1';
const UNITY_PORT = process.env.UNITY_PORT || '8090';
const UNITY_URL = `http://${UNITY_HOST}:${UNITY_PORT}`;

export class UnityClient {
  /**
   * Post tool arguments to Unity HTTP Bridge
   */
  static async post(path: string, data: any = {}): Promise<any> {
    const url = `${UNITY_URL}${path}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Unity bridge returned status: ${response.status}`);
      }

      const resBody = await response.json();
      return resBody;
    } catch (error: any) {
      if (error.cause?.code === 'ECONNREFUSED' || error.code === 'ECONNREFUSED') {
        throw new Error(
          `Unity Editor is not reachable on ${UNITY_URL}. Please ensure Unity is open and the MCPBridge HTTP server is running.`
        );
      }
      throw error;
    }
  }

  /**
   * Check connection to Unity Editor
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${UNITY_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const body = (await res.json()) as any;
        return body.status === 'ok';
      }
      return false;
    } catch {
      return false;
    }
  }
}
