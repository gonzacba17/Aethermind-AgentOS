# Contributing to Aethermind AgentOS

Thank you for your interest in contributing to Aethermind AgentOS! This document provides guidelines and standards for contributing to the project.

## 🎯 Definition of Done for Pull Requests

Before submitting a PR, ensure your changes meet these requirements:

### ✅ Required Checks

- [ ] **Tests pass**: `pnpm test`
- [ ] **Type checking passes**: `pnpm typecheck`
- [ ] **Linting passes**: `pnpm lint`
- [ ] **Build succeeds**: `pnpm build`

### 🧪 Module-Specific Test Requirements

- [ ] **If you modified `StripeService.ts`**: All StripeService tests pass

  ```bash
  pnpm test StripeService
  ```

- [ ] **If you modified auth routes** (`routes/auth.ts`, `routes/oauth.ts`): Auth flow tests pass

  ```bash
  pnpm test auth-flow
  pnpm test auth
  ```

- [ ] **If you modified API routes**: Relevant route tests pass

  ```bash
  pnpm test routes-[module]
  ```

- [ ] **If you modified core services**: Service-specific tests pass
  ```bash
  pnpm test [ServiceName]
  ```

### 📝 Code Quality Standards

- [ ] Code follows TypeScript best practices
- [ ] No console.log statements (use `logger` instead)
- [ ] Error handling is implemented
- [ ] Input validation is in place
- [ ] Comments explain "why", not "what"
- [ ] No hardcoded credentials or secrets

### 🔒 Security Checklist

- [ ] Secrets are in environment variables
- [ ] User inputs are validated and sanitized
- [ ] SQL queries use parameterized statements (Drizzle ORM)
- [ ] Authentication middleware is applied where needed
- [ ] Rate limiting is considered for new endpoints

### 📚 Documentation

- [ ] Update README.md if adding new features
- [ ] Add JSDoc comments to public functions
- [ ] Update API documentation if changing endpoints
- [ ] Add migration guide if breaking changes

### 🧪 Test Coverage Requirements

New code should include tests:

- **Critical paths** (payment, auth): Minimum 80% coverage
- **Business logic**: Minimum 70% coverage
- **Utilities and helpers**: Minimum 60% coverage

Run coverage report:

```bash
pnpm test:coverage
```

## 🚀 Development Workflow

### 1. Fork and Clone

```bash
git clone https://github.com/[your-username]/aethermind-agentos.git
cd aethermind-agentos
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Create Feature Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 4. Make Changes

Follow the code style and quality standards outlined above.

### 5. Test Locally

```bash
# Run all checks
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

### 6. Commit Changes

Use conventional commits format:

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in auth flow"
git commit -m "test: add tests for StripeService"
git commit -m "docs: update API documentation"
git commit -m "chore: update dependencies"
```

**Commit Types:**

- `feat`: New feature
- `fix`: Bug fix
- `test`: Adding tests
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### 7. Push and Create PR

```bash
git push origin feat/your-feature-name
```

Then create a Pull Request on GitHub with:

- Clear description of changes
- Link to related issues
- Screenshots (if UI changes)
- Test results

## 🔍 Code Review Process

1. **Automated checks** run on every PR (CI/CD)
2. **Manual review** by maintainers
3. **Requested changes** if needed
4. **Approval** and merge

## 🐛 Bug Reports

When reporting bugs, include:

- **Environment**: OS, Node version, package versions
- **Steps to reproduce**: Detailed steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Error logs**: Full error messages and stack traces
- **Screenshots**: If applicable

## 💡 Feature Requests

When requesting features:

- **Use case**: Why is this needed?
- **Proposed solution**: How would it work?
- **Alternatives considered**: Other approaches
- **Impact**: Who benefits and how?

## 📞 Getting Help

- **Discord**: [Join our community](#)
- **GitHub Issues**: For bugs and features
- **GitHub Discussions**: For questions and ideas
- **Email**: support@aethermind.io

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Aethermind AgentOS! 🚀
