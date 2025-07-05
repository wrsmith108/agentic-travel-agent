// API Configuration and Base Service

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiService {
  private baseURL: string;
  private devToken: string | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    // Initialize token promise immediately to prevent race conditions
    this.tokenPromise = this.fetchDevToken();
  }

  /**
   * Fetch a real JWT token from the development authentication endpoint
   * This provides valid tokens that pass backend JWT validation
   */
  private async fetchDevToken(): Promise<string> {
    try {
      const url = `${this.baseURL}/api/v1/dev/mock-token`;
      console.log('🔐 Attempting to fetch dev token from:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'dev-frontend-user',
          email: 'dev-frontend@example.com'
        }),
      });

      console.log('🔐 Token fetch response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔐 Token fetch failed with body:', errorText);
        throw new Error(`Failed to fetch dev token: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔐 Token response data:', data);
      
      if (!data?.data?.token) {
        console.error('🔐 No token in response data:', data);
        throw new Error('No token in response');
      }
      
      return data.data.token;
    } catch (error) {
      console.error('🔐 Failed to fetch development token:', error);
      console.error('🔐 Full error details:', error instanceof Error ? error.message : error);
      // Fallback to empty token if dev endpoint fails
      return '';
    }
  }

  /**
   * Ensure we have a valid development token before making requests
   */
  private async ensureDevToken(): Promise<string> {
    // If we already have a token, return it
    if (this.devToken) {
      console.log('Using cached dev token');
      return this.devToken;
    }
    
    // If token is being fetched, wait for the promise
    if (this.tokenPromise) {
      console.log('Waiting for token promise to resolve...');
      this.devToken = await this.tokenPromise;
      this.tokenPromise = null; // Clear the promise after it resolves
      return this.devToken;
    }
    
    // Otherwise, fetch a new token
    console.log('Fetching new dev token...');
    this.devToken = await this.fetchDevToken();
    console.log('Dev token result:', this.devToken ? 'Token obtained' : 'No token (empty string)');
    return this.devToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Ensure we have a valid development token
    const token = await this.ensureDevToken();
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new ApiError(
          `HTTP error! status: ${response.status}`,
          response.status,
          response
        );
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return { success: true } as ApiResponse<T>;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0
      );
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiService = new ApiService();