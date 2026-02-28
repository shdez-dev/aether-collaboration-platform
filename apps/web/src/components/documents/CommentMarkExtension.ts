// apps/web/src/components/documents/CommentMarkExtension.ts
//
// Custom Tiptap Mark that visually highlights text that has an associated
// document comment. Each mark stores a `commentId` attribute so that clicking
// a highlighted span focuses the matching thread in the sidebar.

import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentMark: {
      /** Add a comment highlight mark over the current selection */
      setCommentMark: (commentId: string) => ReturnType;
      /** Remove all comment marks with the given commentId */
      unsetCommentMark: (commentId: string) => ReturnType;
    };
  }
}

export const CommentMarkExtension = Mark.create({
  name: 'commentMark',

  // Marks are inclusive: extending the selection at the edge won't add the mark
  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs) => {
          if (!attrs.commentId) return {};
          return { 'data-comment-id': attrs.commentId };
        },
      },
      resolved: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-comment-resolved') === 'true',
        renderHTML: (attrs) => ({
          'data-comment-resolved': attrs.resolved ? 'true' : 'false',
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'comment-mark',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCommentMark:
        (commentId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { commentId, resolved: false });
        },

      unsetCommentMark:
        (commentId: string) =>
        ({ tr, dispatch }) => {
          const { doc } = tr;
          const markType = this.type;

          let changed = false;
          doc.descendants((node, pos) => {
            if (!node.isText) return;
            node.marks.forEach((mark) => {
              if (mark.type === markType && mark.attrs.commentId === commentId) {
                if (dispatch) {
                  tr.removeMark(pos, pos + node.nodeSize, markType);
                }
                changed = true;
              }
            });
          });

          return changed;
        },
    };
  },
});
