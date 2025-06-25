declare module 'amadeus' {
  export interface Location {
    city: string;
  }

  export interface LocationsResponse {
    data: Array<{
      type: string;
      subType: string;
      name: string;
      iataCode: string;
      address: {
        cityName: string;
        countryCode: string;
      };
    }>;
  }

  export interface ReferenceDataLocations {
    get(params: { keyword: string; subType: string }): Promise<LocationsResponse>;
  }

  export interface ReferenceData {
    locations: ReferenceDataLocations;
  }

  export default class Amadeus {
    constructor(options: { clientId: string; clientSecret: string; hostname?: string });

    referenceData: ReferenceData;

    static location: Location;
  }
}
