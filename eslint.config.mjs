import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: ["dist/**", "node_modules/**", "scripts/**", "*.mjs"],
	},
	...tseslint.configs.recommended.map((c) => ({
		...c,
		files: ["src/**/*.ts"],
	})),
	{
		files: ["src/**/*.ts"],
		rules: {
			// 插件约定：Tab 缩进、注释只写 why，此处仅关闭与现有风格冲突的规则
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
			"@typescript-eslint/no-explicit-any": "off",
		},
	},
);
