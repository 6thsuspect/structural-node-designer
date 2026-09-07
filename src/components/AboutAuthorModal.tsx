import { Theme } from '../types';
import ModalWindow from './ModalWindow';
import AppLogo from './AppLogo';

interface Props {
  isOpen: boolean;
  theme: Theme;
  onClose: () => void;
}

const themeStyles: Record<Theme, { bg: string; text: string; border: string; label: string; accent: string; link: string }> = {
  dark:        { bg: '#1e293b', text: '#e2e8f0', border: '#334155', label: '#94a3b8', accent: '#3b82f6', link: '#60a5fa' },
  light:       { bg: '#ffffff', text: '#1e293b', border: '#e2e8f0', label: '#64748b', accent: '#3b82f6', link: '#2563eb' },
  grasshopper: { bg: '#2d3748', text: '#e2e8f0', border: '#4a5568', label: '#a0aec0', accent: '#68d391', link: '#68d391' },
  autocad:     { bg: '#1a1a1a', text: '#ffffff', border: '#333333', label: '#888888', accent: '#00ff00', link: '#00ff00' },
};

/** "About Me" dialog — minimal author profile with contact links. */
export default function AboutAuthorModal({ isOpen, theme, onClose }: Props) {
  const colors = themeStyles[theme];

  if (!isOpen) return null;

  return (
    <ModalWindow
      icon="👨‍💻"
      title="About the Author"
      overlay="rgba(0,0,0,0.7)"
      bg={colors.bg}
      border={colors.border}
      text={colors.text}
      onClose={onClose}
      initialWidth={460}
      initialHeight={380}
      minWidth={340}
      minHeight={320}
      scrollBody={false}
      resizable={false}
      autoHeight
      persistKey="snd.window.about-author"
      footer={
        <div className="px-6 py-2.5 flex items-center justify-center" style={{ borderTop: `1px solid ${colors.border}` }}>
          <span className="text-[11px]" style={{ color: colors.label }}>
            © 2026 Arvind Singh Rawat. All Rights Reserved.
          </span>
        </div>
      }
    >
      <div className="px-8 py-6" style={{ color: colors.text }}>
        {/* One-line gap below the title bar */}
        <p aria-hidden="true" className="text-[13px] leading-relaxed select-none">&nbsp;</p>
        {/* Logo on the left of name + role */}
        <div className="flex items-center gap-4">
          <AppLogo size={56} />
          <div className="min-w-0">
            <h3 className="text-xl font-bold leading-tight" style={{ color: colors.text }}>
              Arvind Singh Rawat
            </h3>
            <p className="text-sm italic mt-1" style={{ color: colors.accent }}>
              Bridge &amp; Structural Design Engineer
            </p>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed mt-4" style={{ color: colors.text }}>
          Structural engineer with <strong>6+ years of experience</strong> in RCC, PSC and steel bridge
          design. Passionate about combining <strong>structural engineering, design codes and software
          development</strong> to create practical, transparent and reliable engineering tools.
        </p>

        <div className="mt-4 space-y-1.5 text-[13px]">
          <div>
            <a href="mailto:arvindrawat400@gmail.com" className="hover:underline" style={{ color: colors.link }}>
              📧 arvindrawat400@gmail.com
            </a>
          </div>
          <div>
            <a
              href="https://www.linkedin.com/in/arvindrawat400/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: colors.link }}
            >
              💼 linkedin.com/in/arvindrawat400
            </a>
          </div>
        </div>
        {/* One-line gap above the footer */}
        <p aria-hidden="true" className="text-[13px] leading-relaxed select-none">&nbsp;</p>
      </div>
    </ModalWindow>
  );
}
