# Contributing to MixologyHub

Thank you for your interest in contributing to MixologyHub! This document provides guidelines and instructions for contributing to the project.

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Git
- (Optional) Node.js v22+ for local development

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/mixology-hub.git`
3. Set up environment: `cp .env.example .env`
4. Start services: `make start`
5. Access the application:
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000
   - Swagger Docs: http://localhost:3000/api-docs

## 🌿 Git Workflow

### Branch Naming Convention
Use the following prefix for branch names:

- `feature/` - New features or enhancements
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or improvements
- `chore/` - Maintenance tasks

**Examples:**
- `feature/ai-recipe-validation`
- `fix/inventory-calculation-bug`
- `docs/update-api-spec`

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(ai): add recipe validation with JSON schema
fix(inventory): correct unit conversion for ounces
docs(api): update pagination documentation
```

## 🧪 Development Process

### Test-Driven Development (TDD)
1. **Write failing tests** based on use cases in `docs/product/use-cases.md`
2. **Implement minimal code** to make tests pass
3. **Refactor** while keeping tests green

**Test Structure:**
```typescript
describe('UC 1.1: Adding a new ingredient to inventory', () => {
  it('Given the user has no Vodka, When added, Then record is created', () => {
    // Test implementation
  });
});
```

### Code Standards
- Follow TypeScript strict mode
- Use dependency injection (NestJS patterns)
- Angular Signals for frontend state management
- No NgModules - all components are standalone
- ESLint and Prettier configurations must pass

### Testing Requirements
- All new features must include tests
- Backend: Jest unit tests + E2E tests
- Frontend: Vitest component tests
- Coverage thresholds must be maintained

## 🔄 Pull Request Process

### PR Checklist
- [ ] Tests pass: `make test`
- [ ] Code follows project standards
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional format
- [ ] Branch name follows naming convention
- [ ] PR description includes:
  - Summary of changes
  - Related issue numbers
  - Screenshots (for UI changes)
  - Testing instructions

### PR Template
```markdown
## Description
Brief description of the changes

## Related Issues
Closes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Other (please describe)

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)

## Checklist
- [ ] Code follows project standards
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No new warnings/errors
```

## 🏗️ Architecture Guidelines

### Backend (NestJS)
- Follow domain-driven structure
- Use dependency injection
- Implement proper error handling
- Add OpenAPI/Swagger documentation
- Use TypeORM with decimal transformers

### Frontend (Angular)
- Use Signals for state management
- Standalone components only
- Reactive patterns with RxJS
- Component-based architecture
- SCSS for styling

### Database
- Use PostgreSQL decimal types (not float)
- Implement proper migrations
- Follow entity relationship design
- Use TypeORM with proper configuration

## 🐛 Bug Reports

### Reporting Bugs
1. Check if the bug already exists in issues
2. Use the bug report template
3. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Screenshots if applicable

### Bug Fix Process
1. Create `fix/` branch
2. Add failing test demonstrating the bug
3. Fix the issue
4. Ensure all tests pass
5. Submit PR with detailed description

## 💡 Feature Requests

### Suggesting Features
1. Check roadmap in `docs/product/roadmap.md`
2. Use feature request template
3. Include:
   - Problem statement
   - Proposed solution
   - Use cases
   - Mockups if applicable

### Implementing Features
1. Coordinate with maintainers
2. Create `feature/` branch
3. Follow TDD process
4. Update documentation
5. Submit PR for review

## 📚 Documentation

### Documentation Updates
- Keep `README.md` up to date
- Update API documentation in `docs/api/`
- Add architecture decisions as ADRs
- Update use cases for new features
- Keep setup instructions current

### Documentation Standards
- Use clear, concise language
- Include code examples
- Update all related documents
- Verify links work
- Follow markdown best practices

## 🔧 Tooling

### Development Commands
```bash
# Start all services
make start

# Stop services
make stop

# Clean reset (removes volumes)
make clean

# Run tests
make test
make test-backend
make test-frontend
make test-e2e

# Rebuild and restart
make rebuild

# View logs
make logs
```

### Code Quality
- ESLint for TypeScript/JavaScript
- Prettier for code formatting
- Husky for git hooks
- Commitlint for commit validation

## 🤝 Code Review

### Review Process
1. Automated checks pass
2. Maintainer reviews code
3. Address feedback
4. Merge when approved

### Review Guidelines
- Check code quality and standards
- Verify tests are adequate
- Ensure documentation is updated
- Confirm no security issues
- Validate performance considerations

## 📦 Release Process

### Versioning
Follow [Semantic Versioning](https://semver.org/):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Changelog created
- [ ] Version bumped
- [ ] Docker images built
- [ ] Release notes prepared

## 🆘 Getting Help

### Resources
- [API Documentation](http://localhost:3000/api-docs)
- [Architecture Documentation](./docs/architecture/)
- [Use Cases](./docs/product/use-cases.md)
- [Testing Strategy](./docs/development/testing.md)

### Communication
- Use GitHub issues for bugs and features
- Follow the code of conduct
- Be respectful and constructive
- Provide clear, detailed information

## 📄 License
By contributing, you agree that your contributions will be licensed under the project's MIT License.

---

*Thank you for contributing to MixologyHub!* 🍸