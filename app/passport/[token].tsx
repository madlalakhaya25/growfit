import React from 'react';
import { View, Text, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { Tag } from '@/components/ui/Tag';
import { StarRow } from '@/components/ui/StarRow';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export default function PublicPassportScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const { data: passport, isLoading } = useQuery({
    queryKey: ['public-passport', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_public_passport', { p_share_token: token });
      if (error) throw error;
      // An unknown token comes back as `{ error: "Player not found." }`, which
      // is truthy — without this the "Passport Not Found" branch below never
      // fires and the screen renders with every field undefined.
      if (!data || (data as { error?: string }).error) return null;
      return data;
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-pitch items-center justify-center">
        <Text className="text-ink-secondary">Loading passport...</Text>
      </SafeAreaView>
    );
  }

  if (!passport) {
    return (
      <SafeAreaView className="flex-1 bg-pitch items-center justify-center px-8">
        <Text className="text-4xl mb-4">⚽</Text>
        <Text className="text-ink-primary text-title font-bold text-center mb-2">
          Passport Not Found
        </Text>
        <Text className="text-ink-secondary text-body text-center">
          This passport link may be invalid or the player's profile is not public.
        </Text>
      </SafeAreaView>
    );
  }

  const recentRatings: any[] = passport.recent_ratings ?? [];

  return (
    <SafeAreaView className="flex-1 bg-pitch" edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Brand header */}
        <View className="px-4 pt-5 pb-3 flex-row items-center">
          <View className="w-8 h-8 rounded-lg bg-green items-center justify-center mr-3">
            <Text className="text-pitch font-black text-sm">FP</Text>
          </View>
          <Text className="text-ink-secondary text-caption">FootballPath · Digital Passport</Text>
        </View>

        {/* Hero card */}
        <View className="mx-4 mt-2 mb-4 bg-surface-2 rounded-card border border-border overflow-hidden">
          <View className="h-1.5 bg-green" />
          <View className="p-5">
            <View className="flex-row items-center mb-5">
              <Avatar uri={passport.photo_url} name={passport.full_name} size="xl" />
              <View className="ml-4 flex-1">
                <Text className="text-ink-primary font-black text-title">{passport.full_name}</Text>
                {passport.academy_name && (
                  <Text className="text-green text-caption font-semibold mt-0.5">
                    {passport.academy_name}
                  </Text>
                )}
                {passport.team_name && (
                  <Text className="text-ink-secondary text-caption mt-0.5">
                    {passport.team_name}
                  </Text>
                )}
                <View className="flex-row flex-wrap gap-2 mt-2">
                  {passport.position && (
                    <Tag
                      label={passport.position.charAt(0).toUpperCase() + passport.position.slice(1)}
                      variant="green"
                    />
                  )}
                  {passport.age && <Tag label={`Age ${passport.age}`} variant="neutral" />}
                </View>
              </View>
            </View>

            {/* Stats */}
            <View className="flex-row border-t border-border pt-4">
              <View className="flex-1 items-center">
                <Text className="text-green font-black text-title">
                  {passport.rating_average ? Number(passport.rating_average).toFixed(1) : '–'}
                </Text>
                <Text className="text-ink-tertiary text-caption">Avg Rating</Text>
              </View>
              <View className="w-px bg-border" />
              <View className="flex-1 items-center">
                <Text className="text-green font-black text-title">
                  {passport.appearances_count ?? 0}
                </Text>
                <Text className="text-ink-tertiary text-caption">Games Played</Text>
              </View>
              <View className="w-px bg-border" />
              <View className="flex-1 items-center">
                <Text className="text-green font-black text-title">
                  {recentRatings.length}
                </Text>
                <Text className="text-ink-tertiary text-caption">Ratings</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent ratings */}
        {recentRatings.length > 0 && (
          <View className="px-4 mb-6">
            <Text className="text-ink-primary text-heading font-bold mb-3">Recent Ratings</Text>
            {recentRatings.map((r: any, idx: number) => (
              <View key={idx} className="bg-surface-1 border border-border rounded-card p-4 mb-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-ink-secondary text-caption">
                    vs {r.fixture_opponent}
                  </Text>
                  <Text className="text-ink-tertiary text-caption">{r.fixture_date}</Text>
                </View>
                <StarRow rating={r.rating} />
                {r.note && (
                  <Text className="text-ink-secondary text-caption mt-2 italic">"{r.note}"</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Download CTA */}
        <View className="px-4 mb-8">
          <TouchableOpacity
            onPress={() => Linking.openURL('https://footballpath.app')}
            className="bg-green rounded-card py-4 items-center"
          >
            <Text className="text-pitch font-bold text-body">Download FootballPath</Text>
            <Text className="text-pitch/60 text-caption mt-0.5">
              Track development · Coach passports · Scout discovery
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
