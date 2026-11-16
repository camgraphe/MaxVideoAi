import { Focus, MoveRight, Sun, Type, UserRound, Volume2 } from 'lucide-react';
import type { ModelPromptingContent } from '../_lib/model-page-prompting-content';

const marks = { subject: UserRound, framing: Focus, light: Sun, text: Type, motion: MoveRight, sound: Volume2 };

export function ModelCinematicPromptRecipe({ recipe, excerpt = true }: { excerpt?: boolean; recipe: NonNullable<ModelPromptingContent['recipe']> }) {
  return <div className="cinema-prompt-recipe">
    <dl className="cinema-prompt-factors">{recipe.factors.map(factor => {
      const Icon = marks[factor.icon];
      return <div key={factor.title}><dt><Icon size={21} aria-hidden="true" /><span>{factor.title}</span></dt><dd>{factor.body}</dd></div>;
    })}</dl>
    {excerpt ? <div className="cinema-prompt-excerpt"><p className="cinema-eyebrow">{recipe.label}</p><p>{recipe.excerpt}</p><small>{recipe.note}</small></div> : null}
  </div>;
}
