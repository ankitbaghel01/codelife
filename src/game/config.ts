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
  costs: { meal: 120, rent: 4000 },
  travelMinutes: 30, // bus ride between home and anywhere in the city
  rentEvery: 30, // days; the landlord's message says rent is due on day 30
  interview: { minute: 11 * 60, cooldownDays: 7 },
  work: {
    startMinute: 9 * 60,
    endMinute: 18 * 60,
    shiftMinutes: 8 * 60,
    energyCost: 35,
    fullMonthDays: 20,
    promotionEveryDays: 20,
    promotionRaise: 0.15,
    // Problem solving needed to move up from level 1, 2, 3 (a fourth promotion needs 80).
    promotionMinSkill: [35, 50, 65, 80],
    tasksPerDay: 3, // DSA tasks your manager assigns each workday
    taskPay: { easy: 300, medium: 600, hard: 1000 } as Record<string, number>,
    tripEveryTasks: 15, // every 15 work tasks solved earns a company bike trip
    latePayRate: 0.5, // a task left unfinished moves to the next workday and pays half
    absenceWarnAt: 3, // HR warns after this many absences in one pay period
  },
  // Life goes on while you're away: each real day you don't play is one game day (capped).
  away: { maxDays: 30 },
  practiceGain: { easy: 2, medium: 4, hard: 6 } as Record<string, number>,
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
