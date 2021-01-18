import { ILoginRepository } from '../../protocols/domain'
import { SqliteError } from '../../protocols/utils'
import { LoginController } from './login-controller'

function makeSut() {
  const repositorySpy = <ILoginRepository> {
    findByUsernameAndPassword(_content: any) {},
    save(_content: any) {}
  }
  const passwordHasherSpy = {
    hash: jest.fn(async () => 'hashed_password'),
    compare: jest.fn()
  }
  const tokenGeneratorSpy = {
    generate: jest.fn(() => 'any_token'),
    verify: jest.fn()
  }
  const emailValidatorSpy = { isValid: jest.fn(() => true) }

  const sut = new LoginController(
    repositorySpy,
    passwordHasherSpy,
    tokenGeneratorSpy,
    emailValidatorSpy
  )

  return {
    sut,
    repositorySpy,
    passwordHasherSpy,
    tokenGeneratorSpy,
    emailValidatorSpy
  }
}

describe('Login Controller', () => {
  const httpRequest = {
    headers: {},
    params: {},
    query: {},
    body: {
      name: 'any_name',
      username: 'any_username',
      email: 'any@email.com',
      password: 'any_password'
    }
  }

  it('should return the user id, username and token when new user is registered', async () => {
    const {
      sut,
      repositorySpy,
      passwordHasherSpy,
      tokenGeneratorSpy,
      emailValidatorSpy
    } = makeSut()

    const mockedRepositoryReturn = {
      id: 1,
      ...httpRequest.body
    }

    const repositorySaveSpy = jest
      .spyOn(repositorySpy, 'save')
      .mockImplementationOnce(() => Promise.resolve({
        ...mockedRepositoryReturn,
        password: 'hashed_password'
      })
    )

    const response = await sut.create(httpRequest)

    expect(emailValidatorSpy.isValid).toBeCalledWith('any@email.com')
    expect(passwordHasherSpy.hash).toHaveBeenCalledWith('any_password')
    expect(tokenGeneratorSpy.generate).toHaveBeenCalledWith({
      ...mockedRepositoryReturn,
      password: 'hashed_password'
    })

    expect(repositorySaveSpy).toHaveBeenCalledWith({
      ...httpRequest.body,
      password: 'hashed_password'
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      id: 1,
      name: 'any_name',
      username: 'any_username',
      email: 'any@email.com',
      token: 'any_token'
    })
  })

  it('should return a 500 response if repository throws some error', async () => {
    const { sut, repositorySpy } = makeSut()

    jest.spyOn(repositorySpy, 'save')
      .mockImplementationOnce(() => { throw Error('Repository Error') })

    const response = await sut.create(httpRequest)

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      field: '',
      error: 'Repository Error'
    })
  })

  it('should return a 406 response for unique constraint database error', async () => {
    const { sut, repositorySpy } = makeSut()

    jest.spyOn(repositorySpy, 'save')
      .mockImplementationOnce(() => {
        const error = new Error('SQLITE_CONSTRAINT UNIQUE error') as SqliteError
        error.code = 'SQLITE_CONSTRAINT'
        throw error
      })

    const response = await sut.create(httpRequest)

    expect(response.status).toBe(406)
    expect(response.body).toEqual({
      field: '',
      error: 'SQLITE_CONSTRAINT UNIQUE error'
    })
  })

  it('should return a 406 response if no authorization field is provided in login', async () => {
    const { sut } = makeSut()
    const response = await sut.index(httpRequest)

    expect(response.status).toBe(406)
    expect(response.body).toEqual({
      field: 'authorization',
      error: 'Authorization field cannot be empty'
    })
  })

  it('should return a 404 response if no user was found with the given credentials', async () => {
    const { sut, repositorySpy } = makeSut()

    jest.spyOn(repositorySpy, 'findByUsernameAndPassword')
      .mockResolvedValueOnce(null)

    const response = await sut.index({
      ...httpRequest,
      headers: {
        authorization: 'Basic ' + Buffer
          .from('user:password')
          .toString('base64')
      }
    })

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      field: '',
      error: 'Invalid username or password'
    })
  })
})
