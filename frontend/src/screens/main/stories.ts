export type StoryItem = {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  image: string;
  location: string;
  updatedAt: string;
};

export type CampUpdateItem = {
  id: string;
  title: string;
  urgency: "critical" | "high" | "medium" | "low";
  shortDescription: string;
  image: string;
  storyId: string;
};

export const STORIES: StoryItem[] = [
  {
    id: "food-sector-7",
    title: "Food relief in Sector 7 completed in 3 hours",
    shortDescription: "Rapid camp setup enabled meal distribution for 120 families.",
    fullDescription:
      "After intense rainfall alerts, local volunteers and partner organizations converted a school courtyard into a temporary relief center. Through coordinated need mapping, dispatching, and local routing, meal kits reached 120 families in under three hours. The team used field check-ins and geo-tagged updates to avoid duplicate drops and prioritize elderly households first.",
    image: "https://picsum.photos/seed/needmap-story-1/1200/700",
    location: "Sector 7, Prayagraj",
    updatedAt: "Today, 11:40 AM",
  },
  {
    id: "volunteer-response-42",
    title: "Volunteer response improved by 42% this week",
    shortDescription: "Smart matching and better routing reduced assignment delays.",
    fullDescription:
      "Operations teams observed a 42% reduction in average volunteer assignment time this week. The improvement came from urgency-based filtering, cleaner role tagging, and better communication handoffs between owners, admins, and volunteers. Field supervisors also reported fewer unassigned needs in high-priority categories.",
    image: "https://picsum.photos/seed/needmap-story-2/1200/700",
    location: "Lucknow Cluster",
    updatedAt: "Yesterday, 6:10 PM",
  },
  {
    id: "education-camp-nearby",
    title: "New education support camp opened nearby",
    shortDescription: "Evening learning sessions now running for displaced children.",
    fullDescription:
      "A new education support camp started near a temporary shelter zone with daily evening classes, reading circles, and assisted homework sessions. Community teachers and volunteers are coordinating attendance tracking and transport support for children from nearby wards.",
    image: "https://picsum.photos/seed/needmap-story-3/1200/700",
    location: "Kanpur South",
    updatedAt: "Today, 8:05 AM",
  },
];

export const CAMP_UPDATES: CampUpdateItem[] = [
  {
    id: "camp-1",
    title: "Dry ration shortage in Ward 3",
    urgency: "medium",
    shortDescription: "Stock gap flagged for 60+ households; local dispatch scheduled.",
    image: "https://picsum.photos/seed/needmap-camp-1/400/250",
    storyId: "food-sector-7",
  },
  {
    id: "camp-2",
    title: "Sanitation supplies required in Public Area 10",
    urgency: "medium",
    shortDescription: "Camp requested disinfectant kits and PPE refill support.",
    image: "https://picsum.photos/seed/needmap-camp-2/400/250",
    storyId: "volunteer-response-42",
  },
  {
    id: "camp-3",
    title: "Temporary shelter support request in Zone 12",
    urgency: "low",
    shortDescription: "Additional bedding and tarpaulin support needed before rains.",
    image: "https://picsum.photos/seed/needmap-camp-3/400/250",
    storyId: "education-camp-nearby",
  },
];
