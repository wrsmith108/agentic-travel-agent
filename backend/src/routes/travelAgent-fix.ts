// Fix duration type - make days required when passed to service
const fixDuration = (duration?: { days?: number; flexible?: boolean }) => {
  if (!duration || !duration.days) {
    return { days: 7, flexible: duration?.flexible || false };
  }
  return { days: duration.days, flexible: duration.flexible || false };
};

// Fix traveler profile - ensure required fields
const fixTravelerProfile = (profile?: { 
  interests?: string[]; 
  travelStyle?: string; 
  experience?: string;
  concerns?: string[];
}) => {
  return {
    interests: profile?.interests || [],
    travelStyle: profile?.travelStyle || 'moderate',
    experience: profile?.experience,
    concerns: profile?.concerns
  };
};
