const unavailableReply='The explanation is unavailable. Review any available quote before deciding, or send a follow-up to continue.';

// Recognize explicit model protocol markers, not ordinary prose or creative HTML.
const protocolDelimiter=/<\/?(?:analysis|final)>|<\|(?:\/?(?:analysis|final|commentary|summary|assistant|system|developer|user|tool)|im_start|im_sep|im_end|start|end|channel|message|meta_sep|meta_start|endoftext|eot_id|start_header_id|end_header_id)\|>|\b(?:assistant|system|developer|user|tool)[ \t]*\((?:analysis|final|commentary|summary)\)/i;

/** Project only assistant explanation text; raw checkpoints and creative inputs stay exact. */
export function projectStudioReply(reply:string):string {
  return protocolDelimiter.test(reply)?unavailableReply:reply;
}
