import prisma from "./lib/prisma.js";

async function main() {
  console.log("Seeding dating-server database...");

  // 1. Test User (The user using the mobile app)
  let testUser = await prisma.users.findFirst({
    where: { email: "tester@heartsync.com" },
  });

  if (!testUser) {
    testUser = await prisma.users.create({
      data: {
        email: "tester@heartsync.com",
        status: "active",
      },
    });
  }

  const testUserId = testUser.id;
  console.log(`Test user ID: ${testUserId}`);

  // Test user profile
  await prisma.profiles.upsert({
    where: { user_id: testUserId },
    create: {
      user_id: testUserId,
      display_name: "Joshua Edwards",
      birth_date: new Date("1996-05-15"),
      gender: "male",
      job_title: "Product Designer at Google",
      city: "San Francisco",
      bio: "Creative soul who loves designing experiences that matter. When I'm not pushing pixels, you'll find me hiking Bay Area trails.",
      languages: ["English", "Spanish"],
      pet: "Dog",
      life_style: ["Active", "Coffee lover"],
      education: "Stanford University",
      height_cm: 182,
      is_verified: true,
    },
    update: {
      display_name: "Joshua Edwards",
      birth_date: new Date("1996-05-15"),
      gender: "male",
      job_title: "Product Designer at Google",
      city: "San Francisco",
      bio: "Creative soul who loves designing experiences that matter. When I'm not pushing pixels, you'll find me hiking Bay Area trails.",
      languages: ["English", "Spanish"],
      is_verified: true,
    },
  });

  // Test user photo
  const testPhoto = await prisma.photos.findFirst({
    where: { user_id: testUserId },
  });
  if (!testPhoto) {
    await prisma.photos.create({
      data: {
        user_id: testUserId,
        url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
        position: 0,
        is_primary: true,
      },
    });
  }

  // Test user preferences
  await prisma.preferences.upsert({
    where: { user_id: testUserId },
    create: {
      user_id: testUserId,
      interested_in: "everyone",
      age_min: 18,
      age_max: 38,
      max_distance_km: 50,
      show_me: true,
      interested_languages: ["English", "Spanish", "French", "Vietnamese"],
    },
    update: {
      interested_in: "everyone",
      age_min: 18,
      age_max: 38,
      max_distance_km: 50,
    },
  });

  // 2. Candidate Profiles
  const candidatesData = [
    {
      email: "ava.jones@heartsync.test",
      name: "Ava Jones",
      birthDate: new Date("1999-03-20"), // 27 yrs
      gender: "female" as const,
      jobTitle: "Photographer & Art Director",
      city: "San Francisco",
      bio: "Capturing life one frame at a time 📸 Adventure seeker and coffee enthusiast. Love exploring hidden gems and golden hour spots.",
      languages: ["English", "French"],
      pet: "Cat person",
      lifestyle: ["Vegetarian", "Yoga"],
      education: "NYU Tisch",
      heightCm: 168,
      verified: true,
      photos: [
        { url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800", position: 0, is_primary: true },
        { url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800", position: 1, is_primary: false },
      ],
      preLikeTestUser: true, // Will create an incoming like to trigger match!
    },
    {
      email: "sophia.chen@heartsync.test",
      name: "Sophia Chen",
      birthDate: new Date("1998-08-14"), // 28 yrs
      gender: "female" as const,
      jobTitle: "UX Researcher at Figma",
      city: "San Francisco",
      bio: "Curious mind passionate about design ethics, specialty coffee, and analog synthesizers. Looking for authentic connection.",
      languages: ["English", "Mandarin"],
      pet: "Dog person",
      lifestyle: ["Runner", "Bookworm"],
      education: "UC Berkeley",
      heightCm: 165,
      verified: true,
      photos: [
        { url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800", position: 0, is_primary: true },
        { url: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800", position: 1, is_primary: false },
      ],
      preLikeTestUser: false,
    },
    {
      email: "maya.patel@heartsync.test",
      name: "Maya Patel",
      birthDate: new Date("2001-11-05"), // 25 yrs
      gender: "female" as const,
      jobTitle: "Architect & Urban Designer",
      city: "San Francisco",
      bio: "Fascinated by sustainable cities, modern ceramics, and live jazz. Always down for spontaneous road trips along Highway 1.",
      languages: ["English", "Hindi"],
      pet: "Plants only",
      lifestyle: ["Cyclist", "Art lover"],
      education: "Columbia University",
      heightCm: 172,
      verified: true,
      photos: [
        { url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800", position: 0, is_primary: true },
      ],
      preLikeTestUser: false,
    },
    {
      email: "elena.rostova@heartsync.test",
      name: "Elena Rostova",
      birthDate: new Date("2000-02-18"), // 26 yrs
      gender: "female" as const,
      jobTitle: "Ceramics Artist & Curator",
      city: "Oakland",
      bio: "Finding beauty in imperfection. Studio days by day, indie film screenings by night. Tell me your favorite gallery.",
      languages: ["English", "Russian"],
      pet: "Cat person",
      lifestyle: ["Tea lover", "Museums"],
      education: "RISD",
      heightCm: 170,
      verified: false,
      photos: [
        { url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800", position: 0, is_primary: true },
      ],
      preLikeTestUser: true, // Will also trigger match on right swipe!
    },
    {
      email: "chloe.martin@heartsync.test",
      name: "Chloe Martin",
      birthDate: new Date("1997-07-22"), // 29 yrs
      gender: "female" as const,
      jobTitle: "Sommelier & Culinary Writer",
      city: "San Francisco",
      bio: "Pairing natural wines with great conversation. Big fan of farmers markets, sourdough experiments, and slow mornings.",
      languages: ["English", "Italian"],
      pet: "Dog",
      lifestyle: ["Foodie", "Hiking"],
      education: "Culinary Institute of America",
      heightCm: 167,
      verified: true,
      photos: [
        { url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800", position: 0, is_primary: true },
      ],
      preLikeTestUser: false,
    },
    {
      email: "liam.miller@heartsync.test",
      name: "Liam Miller",
      birthDate: new Date("1998-04-10"), // 28 yrs
      gender: "male" as const,
      jobTitle: "Documentary Filmmaker",
      city: "San Francisco",
      bio: "Telling stories from around the globe. When home, you can find me surfing Ocean Beach or listening to vinyl.",
      languages: ["English", "Spanish"],
      pet: "Dog person",
      lifestyle: ["Surfer", "Traveler"],
      education: "USC Cinema",
      heightCm: 185,
      verified: true,
      photos: [
        { url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800", position: 0, is_primary: true },
      ],
      preLikeTestUser: false,
    },
  ];

  for (const candidate of candidatesData) {
    let user = await prisma.users.findFirst({
      where: { email: candidate.email },
    });

    if (!user) {
      user = await prisma.users.create({
        data: {
          email: candidate.email,
          status: "active",
        },
      });
    }

    const userId = user.id;

    // Profile
    await prisma.profiles.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        display_name: candidate.name,
        birth_date: candidate.birthDate,
        gender: candidate.gender,
        job_title: candidate.jobTitle,
        city: candidate.city,
        bio: candidate.bio,
        languages: candidate.languages,
        pet: candidate.pet,
        life_style: candidate.lifestyle,
        education: candidate.education,
        height_cm: candidate.heightCm,
        is_verified: candidate.verified,
      },
      update: {
        display_name: candidate.name,
        birth_date: candidate.birthDate,
        gender: candidate.gender,
        job_title: candidate.jobTitle,
        city: candidate.city,
        bio: candidate.bio,
        languages: candidate.languages,
        pet: candidate.pet,
        life_style: candidate.lifestyle,
        education: candidate.education,
        height_cm: candidate.heightCm,
        is_verified: candidate.verified,
      },
    });

    // Photos
    await prisma.photos.deleteMany({ where: { user_id: userId } });
    for (const photo of candidate.photos) {
      await prisma.photos.create({
        data: {
          user_id: userId,
          url: photo.url,
          position: photo.position,
          is_primary: photo.is_primary,
        },
      });
    }

    // Preferences
    await prisma.preferences.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        interested_in: "everyone",
        age_min: 18,
        age_max: 40,
        max_distance_km: 50,
      },
      update: {
        interested_in: "everyone",
      },
    });

    // If preLikeTestUser is true, create an incoming swipe from this candidate to testUser
    if (candidate.preLikeTestUser) {
      const existingSwipe = await prisma.swipes.findUnique({
        where: {
          swiper_id_swiped_id: {
            swiper_id: userId,
            swiped_id: testUserId,
          },
        },
      });

      if (!existingSwipe) {
        await prisma.swipes.create({
          data: {
            swiper_id: userId,
            swiped_id: testUserId,
            action: "like",
          },
        });
        console.log(`Pre-liked test user by: ${candidate.name} (${userId})`);
      }
    }
  }

  console.log("Seeding completed successfully!");
  console.log(`\n===> Use this ID in DatingApp/.env.local: <===`);
  console.log(`EXPO_PUBLIC_DATING_USER_ID=${testUserId}`);
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
