import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useFitness, FavoriteFood } from "@/contexts/FitnessContext";
import { useStarToast } from "@/hooks/useStarToast";

export function useToggleFavorite({ bottomOffset }: { bottomOffset: number }) {
  const { toggleFavoriteFood, favoriteFoods } = useFitness();
  const { showStarToast, starToastElement } = useStarToast({ bottomOffset });

  const isFavorite = useCallback(
    (name: string) => favoriteFoods.some((f) => f.name === name),
    [favoriteFoods]
  );

  const toggleFavoriteWithToast = useCallback(
    (food: FavoriteFood): boolean => {
      const willStar = !isFavorite(food.name);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleFavoriteFood(food);
      showStarToast(willStar);
      return willStar;
    },
    [isFavorite, toggleFavoriteFood, showStarToast]
  );

  return { toggleFavoriteWithToast, isFavorite, starToastElement };
}
