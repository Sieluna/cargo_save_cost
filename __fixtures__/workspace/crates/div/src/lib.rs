#![no_std]

#[derive(Debug)]
pub struct Error {
    message: &'static str,
}

impl core::fmt::Display for Error {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}", self.message)
    }
}

#[cfg(feature = "std")]
impl std::error::Error for Error {}

pub fn div(dividend: f64, divisor: f64) -> Result<f64, Error> {
    if divisor == 0.0 {
        Err(Error {
            message: "Division by zero",
        })
    } else {
        Ok(dividend / divisor)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_div() {
        assert_eq!(div(10.0, 2.0).unwrap(), 5.0);
    }

    #[test]
    fn test_div_by_zero() {
        assert!(div(10.0, 0.0).is_err());
    }
}
