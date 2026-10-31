import prisma from "../../lib/prisma.js";
import { RELATIONSHIP_INTENTIONS } from "../profiles/relationship-intention.js";

export class DiscoveryGroupsRepository {
  async listRelationshipIntentionCounts() {
    const counts = await prisma.profiles.groupBy({
      by: ["relationship_intention"],
      where: {
        relationship_intention: { not: null },
        users: { is: { status: "active" } },
      },
      _count: { _all: true },
    });
    const countByIntention = new Map(
      counts.map((item) => [item.relationship_intention, item._count._all]),
    );
    return RELATIONSHIP_INTENTIONS.map((value) => ({
      value,
      member_count: countByIntention.get(value) ?? 0,
    }));
  }

  async listActive(userId: string) {
    const [groups, memberships] = await Promise.all([
      prisma.discovery_groups.findMany({
        where: { is_active: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          is_active: true,
          _count: {
            select: {
              members: {
                where: { user: { status: "active", profiles: { isNot: null } } },
              },
            },
          },
        },
      }),
      prisma.discovery_group_members.findMany({
        where: {
          user_id: userId,
          group: { is_active: true },
          user: { status: "active", profiles: { isNot: null } },
        },
        select: { group_id: true },
      }),
    ]);

    const joinedGroupIds = new Set(memberships.map((membership) => membership.group_id));
    return groups.map(({ _count, ...group }) => ({
      ...group,
      member_count: _count.members,
      is_member: joinedGroupIds.has(group.id),
    }));
  }

}
