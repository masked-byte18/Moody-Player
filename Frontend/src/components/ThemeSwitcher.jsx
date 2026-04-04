function ThemeSwitcher({ theme, onToggleTheme }) {
  return (
    <button type="button" className="theme-switch-btn" onClick={onToggleTheme}>
      {theme}
    </button>
  );
}

export default ThemeSwitcher;
