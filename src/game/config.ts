// Game-balance defaults from the PRD (section 5). Change numbers here, not in components.
export const CONFIG = {
  title: "CodeLife",
  start: {
    day: 1,
    minute: 7 * 60 + 30,
    balance: 5000,
    energy: 90,
    hunger: 30,
    education: "Computer Science graduate",
    experience: "Fresher",
    employment: "Unemployed",
    home: "Small rented apartment",
    equipment: "Basic laptop",
  },
  skills: [
    { name: "HTML", proficiency: 40 },
    { name: "CSS", proficiency: 35 },
    { name: "JavaScript", proficiency: 30 },
    { name: "DSA", proficiency: 10 },
    { name: "Problem solving", proficiency: 20 },
    { name: "Communication", proficiency: 25 },
  ],
  costs: { meal: 120 },
  rates: {
    hungerPerHour: 5, // hunger rises 0 → 100
    energyPerHour: 3, // energy falls 100 → 0
    mealHunger: 60,
    mealMinutes: 30,
    wakeMinute: 7 * 60,
    sleepHunger: 25,
  },
  messages: [
    {
      id: "landlord-rent",
      from: "Mr. Gowda (landlord)",
      text: "Good morning. Rent is ₹4,000 this month, due on day 30. Let me know when you find work.",
    },
    {
      id: "faizan-resume",
      from: "Faizan",
      text: "Make your resume today. Companies will start calling once your profile looks good.",
    },
    {
      id: "lakshmi-mock",
      from: "Lakshmi Akka",
      text: "When you are ready, come to my tea stall for a mock interview.",
    },
  ],
} as const;
