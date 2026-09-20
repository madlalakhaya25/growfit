import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { linkChildSchema, type LinkChildInput } from '@/lib/validation';
import { useQueryClient } from '@tanstack/react-query';
import { showAlert } from '@/lib/alert';

export default function LinkChildScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LinkChildInput>({
    resolver: zodResolver(linkChildSchema),
    defaultValues: { code: '' },
  });

  /**
   * This screen used to look a player up by their public `share_token` and
   * insert into `parent_player_links` straight from the device. The token is
   * the public passport URL and is printed on the PDF player card, and the row
   * it wrote granted read and write access to the child's medical record.
   *
   * Linking now goes through `redeem_parent_link_code`, which only accepts a
   * single-use code a coach issued for that specific child. See migration 032.
   */
  const onSubmit = async ({ code }: LinkChildInput) => {
    setLoading(true);

    const { data, error } = await supabase.rpc('redeem_parent_link_code', {
      p_code: code,
      p_relationship: 'Parent',
    });

    setLoading(false);

    // Fail closed when migration 032 has not been applied yet — never fall
    // back to the direct insert this replaces.
    if (error?.code === 'PGRST202') {
      showAlert(
        'Not available yet',
        'Linking a child is temporarily unavailable. Ask your child\'s coach to link you.'
      );
      return;
    }

    const result = data as { success?: boolean; error?: string; child_name?: string } | null;

    if (error || !result || result.error) {
      showAlert('Could not link', result?.error ?? error?.message ?? 'Please try again.');
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['my-children'] });
    showAlert(
      'Linked!',
      `You're now following ${result.child_name ?? 'your child'}. You'll see their fixtures and ratings.`,
      () => router.replace('/(parent)/home' as any)
    );
  };

  return (
    <Screen>
      <TouchableOpacity className="mb-8" onPress={() => router.back()}>
        <Text className="text-ink-secondary text-body">← Back</Text>
      </TouchableOpacity>

      <Text className="text-ink-primary text-hero font-black mb-1">Link Your Child</Text>
      <Text className="text-ink-secondary text-body mb-8">
        Enter the 10-character link code your child's coach gave you. It works
        once and expires after 14 days.
      </Text>

      <Controller
        control={control}
        name="code"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Child link code"
            placeholder="e.g. 7F3A2-9C1B4"
            value={value}
            onChangeText={(t) => onChange(t.toUpperCase())}
            error={errors.code?.message}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        )}
      />

      <View className="mt-4">
        <Button label="Link Player" loading={loading} onPress={handleSubmit(onSubmit)} />
      </View>
    </Screen>
  );
}
