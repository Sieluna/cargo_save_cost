#![no_std]

use div::div;
use vector_types::{Vector2, Vector3, Vector4};

pub fn div_vector_2d(v1: Vector2, v2: Vector2) -> Result<Vector2, div::Error> {
    Ok(Vector2 {
        x: div(v1.x, v2.x)?,
        y: div(v1.y, v2.y)?,
    })
}

pub fn div_vector_3d(v1: Vector3, v2: Vector3) -> Result<Vector3, div::Error> {
    Ok(Vector3 {
        x: div(v1.x, v2.x)?,
        y: div(v1.y, v2.y)?,
        z: div(v1.z, v2.z)?,
    })
}

pub fn div_vector_4d(v1: Vector4, v2: Vector4) -> Result<Vector4, div::Error> {
    Ok(Vector4 {
        x: div(v1.x, v2.x)?,
        y: div(v1.y, v2.y)?,
        z: div(v1.z, v2.z)?,
        w: div(v1.w, v2.w)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_div_vector_2d() {
        let result = div_vector_2d(Vector2::new(10.0, 15.0), Vector2::new(2.0, 3.0)).unwrap();
        assert_eq!(result, Vector2::new(5.0, 5.0));
    }

    #[test]
    fn test_div_vector_3d() {
        let result =
            div_vector_3d(Vector3::new(20.0, 30.0, 40.0), Vector3::new(4.0, 5.0, 8.0)).unwrap();
        assert_eq!(result, Vector3::new(5.0, 6.0, 5.0));
    }

    #[test]
    fn test_div_vector_4d() {
        let result = div_vector_4d(
            Vector4::new(24.0, 36.0, 48.0, 60.0),
            Vector4::new(3.0, 4.0, 6.0, 12.0),
        )
        .unwrap();
        assert_eq!(result, Vector4::new(8.0, 9.0, 8.0, 5.0));
    }

    #[test]
    fn test_div_vector_by_zero() {
        let result = div_vector_2d(Vector2::new(10.0, 15.0), Vector2::new(0.0, 3.0));
        assert!(result.is_err());
    }
}
